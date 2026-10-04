import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as authApi from './api/auth'
import { ApiError } from './api/client'
import * as packagesApi from './api/packages'
import type { User } from './api/types'
import App from './App'

vi.mock('./api/auth')
vi.mock('./api/packages')

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

test('hides the register form from a role without that permission', async () => {
  vi.mocked(authApi.fetchCurrentUser).mockResolvedValue({ ...INTERN, permissions: [] })
  render(<App />)
  expect(await screen.findByText(/does not allow registering/)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Register package' })).not.toBeInTheDocument()
})
