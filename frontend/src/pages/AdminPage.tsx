import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import * as adminApi from '../api/admin'
import type { PermissionInfo, Role, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { messageOf } from '../components/packageDetails'

const NEW_USER = { username: '', full_name: '', password: '', role_id: 0 }

/**
 * Role management for the Chief (dynamic RBAC).
 *
 * Top: a grid of roles × permissions; ticking a box changes what that role
 * may do, effective immediately. Below: users, their role and whether they
 * are active, and a form to add a user. Every change is saved as it is made.
 */
export function AdminPage() {
  const { user: me, refresh } = useAuth()
  const [permissions, setPermissions] = useState<PermissionInfo[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [roleName, setRoleName] = useState('')
  const [newUser, setNewUser] = useState(NEW_USER)

  useEffect(() => {
    Promise.all([adminApi.fetchPermissions(), adminApi.fetchRoles(), adminApi.fetchUsers()])
      .then(([loadedPermissions, loadedRoles, loadedUsers]) => {
        setPermissions(loadedPermissions)
        setRoles(loadedRoles)
        setUsers(loadedUsers)
      })
      .catch((caught) => setError(messageOf(caught, 'Could not load the admin data')))
  }, [])

  /** Run a change; show the backend's reason if it is refused (e.g. lock-out protection). */
  const attempt = async (change: () => Promise<void>) => {
    setError('')
    try {
      await change()
    } catch (caught) {
      setError(messageOf(caught, 'The change could not be saved'))
    }
  }

  const togglePermission = (role: Role, code: string) =>
    attempt(async () => {
      const wanted = role.permissions.includes(code)
        ? role.permissions.filter((c) => c !== code)
        : [...role.permissions, code]
      const updated = await adminApi.setRolePermissions(role.id, wanted)
      setRoles((list) => list.map((r) => (r.id === updated.id ? updated : r)))
      // users of that role now have different permissions
      setUsers(await adminApi.fetchUsers())
      // my own role may have changed: update what the app shows me
      if (me?.role_id === role.id) await refresh()
    })

  const addRole = (event: FormEvent) => {
    event.preventDefault()
    return attempt(async () => {
      const created = await adminApi.createRole(roleName.trim())
      setRoles((list) => [...list, created])
      setRoleName('')
    })
  }

  const changeUser = (target: User, changes: { role_id?: number; is_active?: boolean }) =>
    attempt(async () => {
      const updated = await adminApi.updateUser(target.id, changes)
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)))
      if (me?.id === target.id) await refresh()
    })

  const addUser = (event: FormEvent) => {
    event.preventDefault()
    return attempt(async () => {
      // default to the first role when none was picked
      const created = await adminApi.createUser({ ...newUser, role_id: newUser.role_id || roles[0].id })
      setUsers((list) => [...list, created].sort((a, b) => a.username.localeCompare(b.username)))
      setNewUser(NEW_USER)
    })
  }

  return (
    <>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}

      <section className="card">
        <h1>Roles and permissions</h1>
        <p className="hint">Tick what each role may do. Changes apply immediately.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map((role) => (
                  <th key={role.id} className="center">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.code}>
                  <td>{permission.description}</td>
                  {roles.map((role) => (
                    <td key={role.id} className="center">
                      <input
                        type="checkbox"
                        aria-label={`${role.name}: ${permission.description}`}
                        checked={role.permissions.includes(permission.code)}
                        onChange={() => void togglePermission(role, permission.code)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="inline-form" onSubmit={addRole}>
          <label className="field">
            New role
            <input value={roleName} maxLength={50} onChange={(e) => setRoleName(e.target.value)} />
          </label>
          <button disabled={!roleName.trim()}>Add role</button>
        </form>
      </section>

      <section className="card">
        <h2>Users</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th className="center">Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.full_name}</td>
                  <td>
                    <select
                      aria-label={`Role of ${user.username}`}
                      value={user.role_id}
                      onChange={(e) => void changeUser(user, { role_id: Number(e.target.value) })}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      aria-label={`${user.username} is active`}
                      checked={user.is_active}
                      onChange={(e) => void changeUser(user, { is_active: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="inline-form" onSubmit={addUser} aria-label="Add user">
          <label className="field">
            Username
            <input
              value={newUser.username}
              maxLength={50}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
          </label>
          <label className="field">
            Full name
            <input
              value={newUser.full_name}
              maxLength={100}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>
              Password <small>at least 6 characters</small>
            </span>
            <input
              type="password"
              value={newUser.password}
              autoComplete="new-password"
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          </label>
          <label className="field">
            Role
            <select
              aria-label="Role of the new user"
              value={newUser.role_id || roles[0]?.id || 0}
              onChange={(e) => setNewUser({ ...newUser, role_id: Number(e.target.value) })}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!newUser.username.trim() || newUser.password.length < 6}>Add user</button>
        </form>
      </section>
    </>
  )
}
