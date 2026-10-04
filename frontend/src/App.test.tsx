import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as adminApi from './api/admin'
import * as authApi from './api/auth'
import { ApiError } from './api/client'
import * as packagesApi from './api/packages'
import type { User } from './api/types'
import App from './App'

vi.mock('./api/auth')
vi.mock('./api/packages')
vi.mock('./api/admin')

const INTERN: User = {
  id: 3,
  username: 'intern',
  full_name: 'Demo Intern',
  is_active: true,
  role_id: 3,
  role: 'Intern',
  permissions: ['package.register', 'package.update'],
}

beforeEach(() => {
  window.location.hash = ''
  vi.mocked(packagesApi.searchPackages).mockResolvedValue({ items: [], total: 0 })
  vi.mocked(packagesApi.fetchOutbox).mockResolvedValue([])
  vi.mocked(adminApi.fetchPermissions).mockResolvedValue([])
  vi.mocked(adminApi.fetchRoles).mockResolvedValue([])
  vi.mocked(adminApi.fetchUsers).mockResolvedValue([])
  vi.mocked(packagesApi.fetchOptions).mockResolvedValue({
    package_types: ['Parcel'],
    routes: ['ABC'],
    statuses: ['registered'],
    extra_information_max: 120,
  })
})

test('shows the login form when nobody is logged in', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new ApiError(401, 'Not logged in'))
  render(<App />)
  expect(await screen.findByLabelText('Username')).toBeInTheDocument()
})

test('shows the reason when login fails', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new ApiError(401, 'Not logged in'))
  vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Wrong username or password'))
  const user = userEvent.setup()
  render(<App />)

  await user.type(await screen.findByLabelText('Username'), 'intern')
  await user.type(screen.getByLabelText('Password'), 'nope')
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
})

test('goes to the register page after logging in, and back after logging out', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(new ApiError(401, 'Not logged in'))
  vi.mocked(authApi.login).mockResolvedValue(INTERN)
  vi.mocked(authApi.logout).mockResolvedValue(null)
  const user = userEvent.setup()
  render(<App />)

  await user.type(await screen.findByLabelText('Username'), 'intern')
  await user.type(screen.getByLabelText('Password'), 'intern123')
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(authApi.login).toHaveBeenCalledWith('intern', 'intern123')
  expect(await screen.findByRole('heading', { name: 'Register package' })).toBeInTheDocument()
  expect(screen.getByText('Demo Intern')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByLabelText('Username')).toBeInTheDocument()
})

test('keeps an existing session on page load', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(INTERN)
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Register package' })).toBeInTheDocument()
})

test('a role without register permission gets no register pages and lands on search', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue({ ...INTERN, permissions: [] })
  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Search packages' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Multi register' })).not.toBeInTheDocument()
})

test('the menu only offers Admin to users who may manage roles', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(INTERN)
  const { unmount } = render(<App />)
  await screen.findByRole('heading', { name: 'Register package' })
  expect(screen.getByRole('link', { name: 'Search' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  unmount()

  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue({
    ...INTERN,
    permissions: [...INTERN.permissions, 'rbac.manage'],
  })
  render(<App />)
  expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
})

test('typing the admin address does not open it without permission', async () => {
  window.location.hash = '#/admin'
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(INTERN)
  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Register package' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Roles and permissions' })).not.toBeInTheDocument()
})

test('the menu switches between pages', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(INTERN)
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('link', { name: 'Search' }))
  expect(await screen.findByRole('heading', { name: 'Search packages' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('link', { name: 'Multi register' }))
  expect(await screen.findByRole('heading', { name: 'Multi register' })).toBeInTheDocument()
})
