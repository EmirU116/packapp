import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as packagesApi from '../api/packages'
import { makePackage, OPTIONS } from '../test/fixtures'
import { MultiRegisterPage } from './MultiRegisterPage'

// keep labelUrl real; replace everything that talks to the backend
vi.mock('../api/packages', async (original) => ({
  ...(await original<typeof packagesApi>()),
  fetchOptions: vi.fn(),
  lookupTracking: vi.fn(),
  registerPackages: vi.fn(),
  suggestRecipients: vi.fn(),
  suggestSenders: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(packagesApi.fetchOptions).mockResolvedValue(OPTIONS)
  vi.mocked(packagesApi.lookupTracking).mockResolvedValue({
    tracking_number: 'SHIP-1',
    fields: { carrier: 'DHL' },
    sources: ['pattern'],
  })
  vi.mocked(packagesApi.suggestRecipients).mockResolvedValue([])
  vi.mocked(packagesApi.suggestSenders).mockResolvedValue([])
  vi.mocked(packagesApi.registerPackages).mockResolvedValue([
    makePackage({ id: 11, tracking_number: 'SHIP-1' }),
    makePackage({ id: 12, tracking_number: 'SHIP-1' }),
    makePackage({ id: 13, tracking_number: 'PA-20261004-7KQ2' }),
  ])
})

async function renderPage() {
  const user = userEvent.setup()
  render(<MultiRegisterPage />)
  const scan = await screen.findByLabelText(/Add package/)
  return { user, scan }
}

test('each scan adds a package; the first one fills in the shared details', async () => {
  const { user, scan } = await renderPage()
  await user.type(scan, 'SHIP-1{Enter}')
  await user.type(scan, 'SHIP-1{Enter}')

  const list = screen.getByRole('list')
  expect(within(list).getAllByText('SHIP-1')).toHaveLength(2)
  expect(screen.getByText(/packages in this registration/)).toHaveTextContent('2 packages')
  expect(scan).toHaveValue('')

  // looked up once, for the first scan only
  expect(packagesApi.lookupTracking).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByLabelText(/Carrier/)).toHaveValue('DHL'))
  expect(packagesApi.registerPackages).not.toHaveBeenCalled()
})

test('packages without a number can be added and removed', async () => {
  const { user } = await renderPage()
  await user.click(screen.getByRole('button', { name: 'Add without number' }))
  await user.click(screen.getByRole('button', { name: 'Add without number' }))
  expect(screen.getAllByText('number will be created')).toHaveLength(2)

  await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
  expect(screen.getAllByText('number will be created')).toHaveLength(1)
})

test('saving registers all packages and offers the three print outputs', async () => {
  const { user, scan } = await renderPage()
  await user.type(scan, 'SHIP-1{Enter}')
  await user.type(scan, 'SHIP-1{Enter}')
  await user.click(screen.getByRole('button', { name: 'Add without number' }))
  await user.type(screen.getByLabelText(/Recipient/), 'Anna Berg')
  await user.click(screen.getByRole('button', { name: /Save 3 packages/ }))

  expect(await screen.findByRole('heading', { name: '3 packages registered' })).toBeInTheDocument()
  expect(packagesApi.registerPackages).toHaveBeenCalledWith(
    expect.objectContaining({ recipient: 'Anna Berg', carrier: 'DHL' }),
    ['SHIP-1', 'SHIP-1', ''],
    false,
  )

  const ids = 'ids=11&ids=12&ids=13'
  expect(screen.getByRole('link', { name: /Paper list/ })).toHaveAttribute('href', `/api/labels?${ids}&output=list`)
  expect(screen.getByRole('link', { name: /Label per package/ })).toHaveAttribute(
    'href',
    `/api/labels?${ids}&output=labels`,
  )
  expect(screen.getByRole('link', { name: /One label with the count/ })).toHaveAttribute(
    'href',
    `/api/labels?${ids}&output=summary`,
  )

  // and back to an empty form for the next batch
  await user.click(screen.getByRole('button', { name: 'Register more packages' }))
  expect(await screen.findByLabelText(/Add package/)).toHaveValue('')
  expect(screen.getByText(/packages in this registration/)).toHaveTextContent('0 packages')
})

test('needs at least one package', async () => {
  const { user } = await renderPage()
  await user.type(screen.getByLabelText('Institute'), 'Chemistry')
  await user.click(screen.getByRole('button', { name: /Save/ }))

  expect(screen.getByRole('alert')).toHaveTextContent('Add at least one package')
  expect(packagesApi.registerPackages).not.toHaveBeenCalled()
})

test('needs a recipient or an institute', async () => {
  const { user } = await renderPage()
  await user.click(screen.getByRole('button', { name: 'Add without number' }))
  await user.click(screen.getByRole('button', { name: /Save/ }))

  expect(screen.getByRole('alert')).toHaveTextContent(/recipient, or an institute/)
  expect(packagesApi.registerPackages).not.toHaveBeenCalled()
})

test('a failed save shows the reason and keeps the list', async () => {
  vi.mocked(packagesApi.registerPackages).mockRejectedValue(new ApiError(403, 'Missing permission: package.register'))
  const { user, scan } = await renderPage()
  await user.type(scan, 'SHIP-1{Enter}')
  await user.type(screen.getByLabelText('Institute'), 'Chemistry')
  await user.click(screen.getByRole('button', { name: /Save/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Missing permission')
  expect(within(screen.getByRole('list')).getByText('SHIP-1')).toBeInTheDocument()
})
