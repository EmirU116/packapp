import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as adminApi from '../api/admin'
import { ApiError } from '../api/client'
import type { Role, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AdminPage } from './AdminPage'

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../api/admin')

const CHIEF_ROLE: Role = {
  id: 1,
  name: 'Chief',
  permissions: ['package.register', 'package.delete', 'rbac.manage'],
}
const INTERN_ROLE: Role = { id: 3, name: 'Intern', permissions: ['package.register'] }

const makeUser = (id: number, username: string, role: Role): User => ({
  id,
  username,
  full_name: `Demo ${role.name}`,
  is_active: true,
  role_id: role.id,
  role: role.name,
  permissions: role.permissions,
})
const CHIEF = makeUser(1, 'chief', CHIEF_ROLE)
const INTERN = makeUser(3, 'intern', INTERN_ROLE)

const refresh = vi.fn()

beforeEach(() => {
  refresh.mockReset()
  vi.mocked(useAuth).mockReturnValue({ user: CHIEF, refresh } as unknown as ReturnType<typeof useAuth>)
  vi.mocked(adminApi.fetchPermissions).mockResolvedValue([
    { code: 'package.register', description: 'Register packages' },
    { code: 'package.delete', description: 'Delete packages' },
    { code: 'rbac.manage', description: 'Manage users, roles and permissions' },
  ])
  vi.mocked(adminApi.fetchRoles).mockResolvedValue([CHIEF_ROLE, INTERN_ROLE])
  vi.mocked(adminApi.fetchUsers).mockResolvedValue([CHIEF, INTERN])
})

async function renderPage() {
  const user = userEvent.setup()
  render(<AdminPage />)
  await screen.findByLabelText('Intern: Delete packages')
  return user
}

test('shows which role has which permission', async () => {
  await renderPage()
  expect(screen.getByLabelText('Chief: Delete packages')).toBeChecked()
  expect(screen.getByLabelText('Intern: Register packages')).toBeChecked()
  expect(screen.getByLabelText('Intern: Delete packages')).not.toBeChecked()
})

test('ticking a box grants the permission to that role', async () => {
  vi.mocked(adminApi.setRolePermissions).mockResolvedValue({
    ...INTERN_ROLE,
    permissions: ['package.register', 'package.delete'],
  })
  const user = await renderPage()
  await user.click(screen.getByLabelText('Intern: Delete packages'))

  expect(adminApi.setRolePermissions).toHaveBeenCalledWith(3, ['package.register', 'package.delete'])
  await waitFor(() => expect(screen.getByLabelText('Intern: Delete packages')).toBeChecked())
  // someone else's role: my own session does not need refreshing
  expect(refresh).not.toHaveBeenCalled()
})

test('unticking removes it, and changing my own role refreshes my permissions', async () => {
  vi.mocked(adminApi.setRolePermissions).mockResolvedValue({
    ...CHIEF_ROLE,
    permissions: ['package.register', 'rbac.manage'],
  })
  const user = await renderPage()
  await user.click(screen.getByLabelText('Chief: Delete packages'))

  expect(adminApi.setRolePermissions).toHaveBeenCalledWith(1, ['package.register', 'rbac.manage'])
  await waitFor(() => expect(refresh).toHaveBeenCalled())
})

test('a refused change shows the reason and leaves the box as it was', async () => {
  vi.mocked(adminApi.setRolePermissions).mockRejectedValue(
    new ApiError(400, 'At least one active user must keep the permission to manage roles'),
  )
  const user = await renderPage()
  await user.click(screen.getByLabelText('Chief: Manage users, roles and permissions'))

  expect(await screen.findByRole('alert')).toHaveTextContent('At least one active user')
  expect(screen.getByLabelText('Chief: Manage users, roles and permissions')).toBeChecked()
})

test('adds a role, which appears as a new column', async () => {
  vi.mocked(adminApi.createRole).mockResolvedValue({ id: 4, name: 'Night shift', permissions: [] })
  const user = await renderPage()
  await user.type(screen.getByLabelText('New role'), 'Night shift')
  await user.click(screen.getByRole('button', { name: 'Add role' }))

  expect(adminApi.createRole).toHaveBeenCalledWith('Night shift')
  expect(await screen.findByLabelText('Night shift: Delete packages')).not.toBeChecked()
})

test("changes a user's role", async () => {
  vi.mocked(adminApi.updateUser).mockResolvedValue(makeUser(3, 'intern', CHIEF_ROLE))
  const user = await renderPage()
  await user.selectOptions(screen.getByLabelText('Role of intern'), 'Chief')

  expect(adminApi.updateUser).toHaveBeenCalledWith(3, { role_id: 1 })
  await waitFor(() => expect(screen.getByLabelText('Role of intern')).toHaveValue('1'))
})

test('deactivates a user', async () => {
  vi.mocked(adminApi.updateUser).mockResolvedValue({ ...INTERN, is_active: false })
  const user = await renderPage()
  await user.click(screen.getByLabelText('intern is active'))

  expect(adminApi.updateUser).toHaveBeenCalledWith(3, { is_active: false })
  await waitFor(() => expect(screen.getByLabelText('intern is active')).not.toBeChecked())
})

test('adds a user', async () => {
  vi.mocked(adminApi.createUser).mockResolvedValue({ ...makeUser(9, 'anna', INTERN_ROLE), full_name: 'Anna Berg' })
  const user = await renderPage()
  const add = screen.getByRole('button', { name: 'Add user' })
  expect(add).toBeDisabled()

  await user.type(screen.getByLabelText('Username'), 'anna')
  await user.type(screen.getByLabelText('Full name'), 'Anna Berg')
  await user.type(screen.getByLabelText(/Password/), 'anna-pass')
  await user.selectOptions(screen.getByLabelText('Role of the new user'), 'Intern')
  await user.click(add)

  expect(adminApi.createUser).toHaveBeenCalledWith({
    username: 'anna',
    full_name: 'Anna Berg',
    password: 'anna-pass',
    role_id: 3,
  })
  expect(await screen.findByLabelText('Role of anna')).toHaveValue('3')
  expect(screen.getByLabelText('Username')).toHaveValue('')
})

test('a taken username shows the reason', async () => {
  vi.mocked(adminApi.createUser).mockRejectedValue(new ApiError(409, 'That username is already taken'))
  const user = await renderPage()
  await user.type(screen.getByLabelText('Username'), 'intern')
  await user.type(screen.getByLabelText(/Password/), 'whatever')
  await user.click(screen.getByRole('button', { name: 'Add user' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('already taken')
  // defaults to the first role when none was picked
  expect(adminApi.createUser).toHaveBeenCalledWith(expect.objectContaining({ role_id: 1 }))
})
