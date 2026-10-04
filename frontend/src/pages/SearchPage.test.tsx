import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as packagesApi from '../api/packages'
import type { Permission } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { makePackage, OPTIONS } from '../test/fixtures'
import { SearchPage } from './SearchPage'

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))
// keep labelUrl real; replace everything that talks to the backend
vi.mock('../api/packages', async (original) => ({
  ...(await original<typeof packagesApi>()),
  fetchOptions: vi.fn(),
  searchPackages: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  suggestRecipients: vi.fn(),
  suggestSenders: vi.fn(),
}))

const ANNA = makePackage({ id: 1, tracking_number: 'TRACK-001', recipient: 'Anna Berg' })
const PHYSICS = makePackage({
  id: 2,
  tracking_number: 'TRACK-002',
  recipient: '',
  institute: 'Physics',
  status: 'delivered',
})

/** Log in as someone with exactly these permissions. */
function loginWith(...permissions: Permission[]) {
  vi.mocked(useAuth).mockReturnValue({
    can: (permission: Permission) => permissions.includes(permission),
  } as ReturnType<typeof useAuth>)
}

beforeEach(() => {
  loginWith('package.register', 'package.update', 'package.delete')
  vi.mocked(packagesApi.fetchOptions).mockResolvedValue(OPTIONS)
  vi.mocked(packagesApi.searchPackages).mockResolvedValue({ items: [ANNA, PHYSICS], total: 2 })
  vi.mocked(packagesApi.suggestRecipients).mockResolvedValue([])
  vi.mocked(packagesApi.suggestSenders).mockResolvedValue([])
  vi.mocked(packagesApi.updatePackage).mockResolvedValue(ANNA)
  vi.mocked(packagesApi.deletePackage).mockResolvedValue(null)
})

async function renderPage() {
  const user = userEvent.setup()
  render(<SearchPage />)
  await screen.findByText('TRACK-001')
  return user
}

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement

test('lists packages, showing the institute when there is no recipient', async () => {
  await renderPage()
  expect(within(rowOf('TRACK-001')).getByText('Anna Berg')).toBeInTheDocument()
  expect(within(rowOf('TRACK-002')).getByText('Physics')).toBeInTheDocument()
  expect(within(rowOf('TRACK-002')).getByText('delivered')).toBeInTheDocument()
  expect(screen.getByText('1–2 of 2')).toBeInTheDocument()
})

test('searches while typing, with the text sent once typing stops', async () => {
  const user = await renderPage()
  await user.type(screen.getByLabelText(/Search/), 'anna')

  await waitFor(() =>
    expect(packagesApi.searchPackages).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'anna', offset: 0 })),
  )
  // not one request per letter
  const texts = vi.mocked(packagesApi.searchPackages).mock.calls.map(([params]) => params.q)
  expect(texts).not.toContain('an')
})

test('filters by date', async () => {
  const user = await renderPage()
  await user.type(screen.getByLabelText('From date'), '2026-10-01')
  await user.type(screen.getByLabelText('To date'), '2026-10-04')

  await waitFor(() =>
    expect(packagesApi.searchPackages).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateFrom: '2026-10-01', dateTo: '2026-10-04' }),
    ),
  )
})

test('says so when nothing matches', async () => {
  vi.mocked(packagesApi.searchPackages).mockResolvedValue({ items: [], total: 0 })
  render(<SearchPage />)
  expect(await screen.findByText('No packages match.')).toBeInTheDocument()
})

test('pages through long results', async () => {
  vi.mocked(packagesApi.searchPackages).mockResolvedValue({ items: [ANNA, PHYSICS], total: 60 })
  const user = await renderPage()
  expect(screen.getByText('1–25 of 60')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(packagesApi.searchPackages).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25 })),
  )
  expect(await screen.findByText('26–50 of 60')).toBeInTheDocument()
})

test('every row links to its label', async () => {
  await renderPage()
  expect(within(rowOf('TRACK-002')).getByRole('link', { name: 'Label' })).toHaveAttribute(
    'href',
    '/api/labels?ids=2&output=labels',
  )
})

test('an intern can edit but gets no delete button', async () => {
  loginWith('package.register', 'package.update')
  await renderPage()
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

test('without update permission there is no edit or delivered button', async () => {
  loginWith()
  await renderPage()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delivered' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Label' })).toHaveLength(2)
})

test('delete asks for confirmation first', async () => {
  const user = await renderPage()
  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Delete' }))
  expect(packagesApi.deletePackage).not.toHaveBeenCalled()

  // cancelling leaves the package alone
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()

  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Delete' }))
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(packagesApi.deletePackage).toHaveBeenCalledWith(1)
  // the list is fetched again afterwards
  await waitFor(() => expect(packagesApi.searchPackages).toHaveBeenCalledTimes(2))
})

test('a refused delete shows the reason', async () => {
  vi.mocked(packagesApi.deletePackage).mockRejectedValue(new ApiError(403, 'Missing permission: package.delete'))
  const user = await renderPage()
  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Delete' }))
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Missing permission')
})

test('marking delivered and undoing it', async () => {
  const user = await renderPage()
  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Delivered' }))
  expect(packagesApi.updatePackage).toHaveBeenCalledWith(1, { status: 'delivered' })

  await user.click(within(rowOf('TRACK-002')).getByRole('button', { name: 'Undo delivered' }))
  expect(packagesApi.updatePackage).toHaveBeenCalledWith(2, { status: 'registered' })
})

test('editing a package saves the changes and refreshes the list', async () => {
  const user = await renderPage()
  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Edit' }))

  const form = screen.getByRole('form', { name: 'Edit package' })
  const room = within(form).getByLabelText('Room number')
  expect(room).toHaveValue('C412')
  await user.clear(room)
  await user.type(room, 'D101')
  await user.selectOptions(within(form).getByLabelText('Status'), 'delivered')
  await user.click(within(form).getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(packagesApi.updatePackage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        room_number: 'D101',
        status: 'delivered',
        tracking_number: 'TRACK-001',
        recipient: 'Anna Berg',
      }),
    ),
  )
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit package' })).not.toBeInTheDocument())
  expect(packagesApi.searchPackages).toHaveBeenCalledTimes(2)
})

test('editing can be cancelled without saving', async () => {
  const user = await renderPage()
  await user.click(within(rowOf('TRACK-001')).getByRole('button', { name: 'Edit' }))
  const form = screen.getByRole('form', { name: 'Edit package' })
  await user.click(within(form).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('form', { name: 'Edit package' })).not.toBeInTheDocument()
  expect(packagesApi.updatePackage).not.toHaveBeenCalled()
})
