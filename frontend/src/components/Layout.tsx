import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

/** Page frame for logged-in users: top bar with who is logged in, then the page. */
export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <span className="brand">PackApp</span>
        <span className="spacer" />
        <span className="who">
          {user?.full_name || user?.username} <small>{user?.role}</small>
        </span>
        <button type="button" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      <main className="page">{children}</main>
    </>
  )
}
