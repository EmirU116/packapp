import { useEffect, useState } from 'react'
import { suggestRecipients, suggestSenders } from '../api/packages'
import type { PackageDetails, PackageOptions, RecipientSuggestion } from '../api/types'

interface Props {
  value: PackageDetails
  onChange: (value: PackageDetails) => void
  options: PackageOptions
  /** Fields just filled in automatically; they are highlighted. */
  autoFilled?: ReadonlySet<string>
}

/**
 * Suggestions from the backend for what is typed in a field.
 * Waits briefly after the last keystroke so it does not ask on every key.
 */
function useSuggestions<T>(query: string, fetcher: (q: string) => Promise<T[]>): T[] {
  const [items, setItems] = useState<T[]>([])
  // too little typed to be worth asking about
  const tooShort = query.trim().length < 2
  useEffect(() => {
    if (tooShort) return
    const timer = setTimeout(() => {
      fetcher(query.trim())
        .then(setItems)
        .catch(() => setItems([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [query, tooShort, fetcher])
  return tooShort ? [] : items
}

/**
 * The package details fields (everything except the tracking number).
 *
 * Reused by single register, multi register and editing, so the fields and
 * their rules exist in one place. The parent owns the values.
 */
export function PackageForm({ value, onChange, options, autoFilled }: Props) {
  const senders = useSuggestions(value.sender, suggestSenders)
  const recipients = useSuggestions<RecipientSuggestion>(value.recipient, suggestRecipients)

  const set = (field: keyof PackageDetails, fieldValue: string) =>
    onChange({ ...value, [field]: fieldValue })

  /**
   * When the typed name matches a recipient registered before, fill in
   * that person's delivery details – but never overwrite what is already typed.
   */
  const setRecipient = (name: string) => {
    const known = recipients.find((r) => r.recipient.toLowerCase() === name.trim().toLowerCase())
    if (!known) return set('recipient', name)
    onChange({
      ...value,
      recipient: known.recipient,
      institute: value.institute || known.institute,
      route: value.route || (known.route ?? ''),
      su_number: value.su_number || known.su_number,
      email: value.email || known.email,
      room_number: value.room_number || known.room_number,
    })
  }

  const className = (field: string) => (autoFilled?.has(field) ? 'field auto-filled' : 'field')
  const remaining = options.extra_information_max - value.extra_information.length

  return (
    <>
      <fieldset>
        <legend>Package</legend>
        <div className="grid">
          <label className={className('package_type')}>
            Type
            <select value={value.package_type} onChange={(e) => set('package_type', e.target.value)}>
              {options.package_types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className={className('carrier')}>
            <span>
              Carrier <small>who drove it</small>
            </span>
            <input value={value.carrier} maxLength={100} onChange={(e) => set('carrier', e.target.value)} />
          </label>
          <label className={`${className('sender')} wide`}>
            <span>
              From <small>company that sent it</small>
            </span>
            <input
              value={value.sender}
              maxLength={100}
              list="sender-suggestions"
              onChange={(e) => set('sender', e.target.value)}
            />
            <datalist id="sender-suggestions">
              {senders.map((sender) => (
                <option key={sender} value={sender} />
              ))}
            </datalist>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>To</legend>
        <div className="grid">
          <label className={className('recipient')}>
            <span>
              Recipient <small>leave empty to deliver to the institute</small>
            </span>
            <input
              value={value.recipient}
              maxLength={100}
              list="recipient-suggestions"
              onChange={(e) => setRecipient(e.target.value)}
            />
            <datalist id="recipient-suggestions">
              {recipients.map((r) => (
                <option key={r.recipient} value={r.recipient}>
                  {[r.institute, r.room_number].filter(Boolean).join(' · ')}
                </option>
              ))}
            </datalist>
          </label>
          <label className={className('institute')}>
            Institute
            <input value={value.institute} maxLength={100} onChange={(e) => set('institute', e.target.value)} />
          </label>
          <label className={className('route')}>
            Route
            <select value={value.route} onChange={(e) => set('route', e.target.value)}>
              <option value="">–</option>
              {options.routes.map((route) => (
                <option key={route}>{route}</option>
              ))}
            </select>
          </label>
          <label className={className('room_number')}>
            Room number
            <input value={value.room_number} maxLength={50} onChange={(e) => set('room_number', e.target.value)} />
          </label>
          <label className={className('su_number')}>
            SU number
            <input value={value.su_number} maxLength={50} onChange={(e) => set('su_number', e.target.value)} />
          </label>
          <label className={className('email')}>
            Email
            <input type="email" value={value.email} maxLength={100} onChange={(e) => set('email', e.target.value)} />
          </label>
        </div>
      </fieldset>

      <label className="field">
        Extra information
        <textarea
          rows={2}
          value={value.extra_information}
          maxLength={options.extra_information_max}
          onChange={(e) => set('extra_information', e.target.value)}
        />
        <small className={remaining <= 10 ? 'counter low' : 'counter'}>{remaining} characters left</small>
      </label>
    </>
  )
}
