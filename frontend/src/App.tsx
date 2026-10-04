import type { ReactNode } from 'react'
import type { Permission } from './api/types'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { useHashRoute } from './hooks/useHashRoute'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { MultiRegisterPage } from './pages/MultiRegisterPage'
import { OutboxPage } from './pages/OutboxPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'

interface Page {
  route: string
  label: string
  element: ReactNode
  /** Permission needed to see the page; pages without one are open to every logged-in user. */
  needs?: Permission
}

// The pages in menu order. To add a page, add it here.
const PAGES: Page[] = [
  { route: 'register', label: 'Register', element: <RegisterPage />, needs: 'package.register' },
  { route: 'multi', label: 'Multi register', element: <MultiRegisterPage />, needs: 'package.register' },
  { route: 'search', label: 'Search', element: <SearchPage /> },
  { route: 'outbox', label: 'Email outbox', element: <OutboxPage /> },
  { route: 'admin', label: 'Admin', element: <AdminPage />, needs: 'rbac.manage' },
]

function Pages() {
  const { user, loading, can } = useAuth()
  const route = useHashRoute()

  if (loading) return null
  if (!user) return <LoginPage />

  // only the pages this user's role allows; an unknown or forbidden address shows the first one
  const allowed = PAGES.filter((page) => !page.needs || can(page.needs))
  const page = allowed.find((candidate) => candidate.route === route) ?? allowed[0]

  return (
    <Layout nav={allowed} current={page.route}>
      {page.element}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Pages />
    </AuthProvider>
  )
}
