import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

export interface NavItem {
  route: string
  label: string
}

interface Props {
  nav: NavItem[]
  current: string
  children: ReactNode
}

/** Page frame for logged-in users: top bar with navigation and who is logged in, then the page. */
export function Layout({ nav, current, children }: Props) {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <span className="brand">PackApp</span>
        <nav>
          {nav.map((item) => (
            <a
              key={item.route}
              href={`#/${item.route}`}
              className={item.route === current ? 'active' : undefined}
              aria-current={item.route === current ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
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
