import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not log in')
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>PackApp</h1>
        <label className="field">
          Username
          <input value={username} autoFocus autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy || !username || !password}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  )
}
