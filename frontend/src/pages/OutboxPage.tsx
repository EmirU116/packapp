import { useEffect, useState } from 'react'
import { fetchOutbox } from '../api/packages'
import type { OutboxMessage } from '../api/types'
import { messageOf } from '../components/packageDetails'

/**
 * The local email outbox: the notifications that would have been sent.
 * Nothing is really emailed in the MVP, so this is where to see them.
 */
export function OutboxPage() {
  const [messages, setMessages] = useState<OutboxMessage[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOutbox()
      .then(setMessages)
      .catch((caught) => setError(messageOf(caught, 'Could not load the outbox')))
  }, [])

  return (
    <section className="card">
      <h1>Email outbox</h1>
      <p className="hint">Notifications are not really sent yet. This shows what would have been emailed.</p>
      {error && <p className="message error">{error}</p>}
      {messages?.length === 0 && <p className="message info">No notifications yet.</p>}
      <ul className="outbox">
        {messages?.map((message) => (
          <li key={message.id}>
            <div>
              <strong>{message.subject}</strong>
              <small>
                {' '}
                to {message.to_email} · {message.created_at.replace('T', ' ').slice(0, 16)}
              </small>
            </div>
            <pre>{message.body}</pre>
          </li>
        ))}
      </ul>
    </section>
  )
}
