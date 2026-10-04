import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

function Pages() {
  const { user, loading, can } = useAuth()

  if (loading) return null
  if (!user) return <LoginPage />

  return (
    <Layout>
      {can('package.register') ? (
        <RegisterPage />
      ) : (
        <p className="message info">Your role does not allow registering packages.</p>
      )}
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
