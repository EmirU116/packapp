import { api } from './client'
import type { PermissionInfo, Role, User } from './types'

export const fetchPermissions = () => api<PermissionInfo[]>('/api/admin/permissions')

export const fetchRoles = () => api<Role[]>('/api/admin/roles')

export const createRole = (name: string) =>
  api<Role>('/api/admin/roles', { method: 'POST', body: { name, permissions: [] } })

/** Replace a role's permissions with the given complete list. */
export const setRolePermissions = (roleId: number, permissions: string[]) =>
  api<Role>(`/api/admin/roles/${roleId}/permissions`, { method: 'PUT', body: { permissions } })

export const fetchUsers = () => api<User[]>('/api/admin/users')

export interface NewUser {
  username: string
  full_name: string
  password: string
  role_id: number
}

export const createUser = (user: NewUser) => api<User>('/api/admin/users', { method: 'POST', body: user })

export const updateUser = (userId: number, changes: { role_id?: number; is_active?: boolean }) =>
  api<User>(`/api/admin/users/${userId}`, { method: 'PATCH', body: changes })
