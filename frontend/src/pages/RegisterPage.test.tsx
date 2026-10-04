import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as packagesApi from '../api/packages'
import type { Package } from '../api/types'
import { RegisterPage } from './RegisterPage'

// keep labelUrl real; replace everything that talks to the backend
vi.mock('../api/packages', async (original) => ({
  ...(await original<typeof packagesApi>()),
  fetchOptions: vi.fn(),
  lookupTracking: vi.fn(),
  generateTrackingNumber: vi.fn(),
  registerPackage: vi.fn(),
  suggestRecipients: vi.fn(),
  suggestSenders: vi.fn(),
}))

const SAVED: Package = {
  id: 7,
  tracking_number: '1Z999AA10123456784',
  carrier: 'UPS',
  package_type: 'Parcel',
  sender: '',
  recipient: 'Anna Berg',
  institute: '',
  route: null,
  su_number: '',
  email: '',
  room_number: '',
  extra_information: '',
  status: 'registered',
  created_at: '2026-10-04T12:00:00',
  updated_at: '2026-10-04T12:00:00',
  created_by: 'intern',
}

// stands in for the browser tab that shows the label PDF
let labelTab: { location: { href: string }; close: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.mocked(packagesApi.fetchOptions).mockResolvedValue({
    package_types: ['Cold', 'Parcel', 'Frozen'],
    routes: ['ABC', 'DEF'],
    statuses: ['registered', 'delivered'],
    extra_information_max: 120,
  })
  vi.mocked(packagesApi.lookupTracking).mockResolvedValue({
    tracking_number: '1Z999AA10123456784',
    fields: { carrier: 'UPS' },
    sources: ['pattern'],
  })
  vi.mocked(packagesApi.suggestRecipients).mockResolvedValue([])
  vi.mocked(packagesApi.suggestSenders).mockResolvedValue([])
  vi.mocked(packagesApi.registerPackage).mockResolvedValue(SAVED)

  labelTab = { location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(labelTab as unknown as Window)
})

async function renderPage() {
  const user = userEvent.setup()
  render(<RegisterPage />)
  const scan = await screen.findByLabelText(/Tracking number/)
  return { user, scan }
}

test('the scan field has focus so a scanner can type straight into it', async () => {
  const { scan } = await renderPage()
  expect(scan).toHaveFocus()
})

test('scanning (number + Enter) looks the number up and fills the form without saving', async () => {
  const { user, scan } = await renderPage()
  await user.type(scan, '1Z999AA10123456784{Enter}')

  expect(packagesApi.lookupTracking).toHaveBeenCalledWith('1Z999AA10123456784')
  await waitFor(() => expect(screen.getByLabelText(/Carrier/)).toHaveValue('UPS'))
  expect(screen.getByText(/Filled in automatically: carrier/)).toBeInTheDocument()
  expect(packagesApi.registerPackage).not.toHaveBeenCalled()
})

test('says so when the lookup finds nothing, and still allows manual entry', async () => {
  vi.mocked(packagesApi.lookupTracking).mockResolvedValue({ tracking_number: 'X', fields: {}, sources: [] })
  const { user, scan } = await renderPage()
  await user.type(scan, 'X{Enter}')
  expect(await screen.findByText(/Nothing found/)).toBeInTheDocument()
})

test('a failing lookup does not block registration', async () => {
  vi.mocked(packagesApi.lookupTracking).mockRejectedValue(new ApiError(500, 'boom'))
  const { user, scan } = await renderPage()
  await user.type(scan, 'X{Enter}')
  expect(await screen.findByText(/Lookup is unavailable/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save and print label' })).toBeEnabled()
})

test('saving registers the package, opens its label and gets ready for the next scan', async () => {
  const { user, scan } = await renderPage()
  await user.type(scan, '1Z999AA10123456784{Enter}')
  await waitFor(() => expect(screen.getByLabelText(/Carrier/)).toHaveValue('UPS'))
  await user.type(screen.getByLabelText(/Recipient/), 'Anna Berg')
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))

  await waitFor(() => expect(labelTab.location.href).toBe('/api/labels?ids=7&output=labels'))
  expect(packagesApi.registerPackage).toHaveBeenCalledWith(
    expect.objectContaining({
      tracking_number: '1Z999AA10123456784',
      carrier: 'UPS',
      recipient: 'Anna Berg',
      package_type: 'Parcel',
      notify: false,
    }),
  )
  // exactly one label tab
  expect(window.open).toHaveBeenCalledTimes(1)

  // form is cleared and the scan field is focused again
  expect(scan).toHaveValue('')
  expect(screen.getByLabelText(/Recipient/)).toHaveValue('')
  expect(scan).toHaveFocus()
  expect(screen.getByRole('link', { name: 'Print label again' })).toHaveAttribute(
    'href',
    '/api/labels?ids=7&output=labels',
  )
})

test('needs a recipient or an institute before saving', async () => {
  const { user } = await renderPage()
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))

  expect(screen.getByRole('alert')).toHaveTextContent(/recipient, or an institute/)
  expect(packagesApi.registerPackage).not.toHaveBeenCalled()
  expect(window.open).not.toHaveBeenCalled()
})

test('the institute alone is enough', async () => {
  const { user } = await renderPage()
  await user.type(screen.getByLabelText('Institute'), 'Chemistry')
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))
  await waitFor(() => expect(packagesApi.registerPackage).toHaveBeenCalled())
})

test('email notification needs an address', async () => {
  const { user } = await renderPage()
  await user.type(screen.getByLabelText('Institute'), 'Chemistry')
  await user.click(screen.getByLabelText(/Send email notification/))
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))
  expect(screen.getByRole('alert')).toHaveTextContent(/email address is needed/)

  await user.type(screen.getByLabelText('Email'), 'anna@example.com')
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))
  await waitFor(() =>
    expect(packagesApi.registerPackage).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'anna@example.com', notify: true }),
    ),
  )
})

test('a failed save shows the reason, closes the label tab and keeps what was typed', async () => {
  vi.mocked(packagesApi.registerPackage).mockRejectedValue(new ApiError(422, 'email: Not a valid email address'))
  const { user } = await renderPage()
  await user.type(screen.getByLabelText('Institute'), 'Chemistry')
  await user.click(screen.getByRole('button', { name: 'Save and print label' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Not a valid email address')
  expect(labelTab.close).toHaveBeenCalled()
  expect(screen.getByLabelText('Institute')).toHaveValue('Chemistry')
})

test('"No tracking number" creates one', async () => {
  vi.mocked(packagesApi.generateTrackingNumber).mockResolvedValue({ tracking_number: 'PA-20261004-7KQ2' })
  const { user, scan } = await renderPage()
  await user.click(screen.getByRole('button', { name: 'No tracking number' }))

  await waitFor(() => expect(scan).toHaveValue('PA-20261004-7KQ2'))
  expect(packagesApi.lookupTracking).not.toHaveBeenCalled()
})

test('extra information shows how many characters are left and stops at the limit', async () => {
  const { user } = await renderPage()
  const extra = screen.getByLabelText(/Extra information/)
  expect(screen.getByText('120 characters left')).toBeInTheDocument()

  await user.type(extra, 'Fragile')
  expect(screen.getByText('113 characters left')).toBeInTheDocument()
  expect(extra).toHaveAttribute('maxlength', '120')
})

test('picking a known recipient fills in their delivery details', async () => {
  vi.mocked(packagesApi.suggestRecipients).mockResolvedValue([
    {
      recipient: 'Anna Berg',
      institute: 'Chemistry',
      route: 'ABC',
      su_number: 'SU-1',
      email: 'anna@example.com',
      room_number: 'C412',
    },
  ])
  const { user } = await renderPage()
  const recipient = screen.getByLabelText(/Recipient/)
  await user.type(recipient, 'Anna Ber')
  await waitFor(() => expect(packagesApi.suggestRecipients).toHaveBeenCalled())
  // wait until the suggestion has been offered, then finish the name
  await waitFor(() => expect(document.querySelector('#recipient-suggestions option')).not.toBeNull())
  await user.type(recipient, 'g')

  expect(screen.getByLabelText('Institute')).toHaveValue('Chemistry')
  expect(screen.getByLabelText('Route')).toHaveValue('ABC')
  expect(screen.getByLabelText('Room number')).toHaveValue('C412')
  expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com')
})
