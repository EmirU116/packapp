import { api } from './client'
import type { User } from './types'

export const login = (username: string, password: string) =>
  api<User>('/api/auth/login', { method: 'POST', body: { username, password } })

export const logout = () => api<null>('/api/auth/logout', { method: 'POST' })

export const fetchCurrentUser = () => api<User>('/api/auth/me')
