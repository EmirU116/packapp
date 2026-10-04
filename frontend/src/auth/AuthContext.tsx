import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { Permission, User } from '../api/types'

interface AuthState {
  /** The logged-in user, or null when nobody is logged in. */
  user: User | null
  /** True until the first check of an existing session has finished. */
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Whether the user may do something – used to show or hide actions. */
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On page load, pick up a session that is still valid from an earlier visit
  useEffect(() => {
    authApi
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setUser(await authApi.login(username, password))
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>')
  return state
}
