import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  fetchOptions,
  generateTrackingNumber,
  labelUrl,
  lookupTracking,
  registerPackage,
} from '../api/packages'
import type { Package, PackageDetails, PackageOptions } from '../api/types'
import { PackageForm } from '../components/PackageForm'
import { checkDetails, describeLookup, EMPTY_DETAILS, messageOf } from '../components/packageDetails'

/**
 * Single register – the core workflow:
 * scan → auto-fill → edit if needed → save and print one label.
 *
 * After saving, the form is cleared and the cursor returns to the scan
 * field, so the next package can be scanned straight away.
 */
export function RegisterPage() {
  const [options, setOptions] = useState<PackageOptions | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [details, setDetails] = useState<PackageDetails>(EMPTY_DETAILS)
  const [notify, setNotify] = useState(false)
  const [autoFilled, setAutoFilled] = useState<ReadonlySet<string>>(new Set())
  const [lookupNote, setLookupNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState<Package[]>([])

  const scanField = useRef<HTMLInputElement>(null)
  // the number the form was last auto-filled for, to avoid repeating a lookup
  const lookedUp = useRef('')

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch((caught: Error) => setError(caught.message))
  }, [])

  /** Step 2 of the workflow: ask the backend what it knows about the number. */
  const lookup = async () => {
    const number = trackingNumber.trim()
    if (!number || number === lookedUp.current) return
    lookedUp.current = number
    try {
      const { fields } = await lookupTracking(number)
      setDetails((current) => ({ ...current, ...fields }))
      setAutoFilled(new Set(Object.keys(fields)))
      setLookupNote(describeLookup(fields))
    } catch {
      // a failed lookup must never block manual registration
      setLookupNote('Lookup is unavailable – fill in the details by hand.')
    }
  }

  const onScanKey = (event: KeyboardEvent<HTMLInputElement>) => {
    // barcode scanners "type" the number and press Enter: look up instead of saving
    if (event.key === 'Enter') {
      event.preventDefault()
      void lookup()
    }
  }

  const generate = async () => {
    setError('')
    try {
      const { tracking_number } = await generateTrackingNumber()
      // a generated number has nothing to look up
      lookedUp.current = tracking_number
      setTrackingNumber(tracking_number)
      setLookupNote('Tracking number created for a package without one.')
    } catch (caught) {
      setError(messageOf(caught, 'Could not create a tracking number'))
    }
  }

  const reset = () => {
    setTrackingNumber('')
    setDetails(EMPTY_DETAILS)
    setNotify(false)
    setAutoFilled(new Set())
    setLookupNote('')
    setError('')
    lookedUp.current = ''
    scanField.current?.focus()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const problem = checkDetails(details, notify)
    if (problem) {
      setError(problem)
      return
    }

    // Open the tab now, while the click still counts as a user action;
    // opening it after the save would be stopped by the popup blocker.
    const labelTab = window.open('', '_blank')
    setSaving(true)
    setError('')
    try {
      const saved = await registerPackage({ ...details, tracking_number: trackingNumber.trim(), notify })
      if (labelTab) labelTab.location.href = labelUrl([saved.id])
      setRecent((list) => [saved, ...list].slice(0, 5))
      reset()
    } catch (caught) {
      labelTab?.close()
      setError(messageOf(caught, 'Could not save the package'))
    } finally {
      setSaving(false)
    }
  }

  if (!options) {
    return error ? <p className="message error">{error}</p> : <p>Loading…</p>
  }

  return (
    <>
      <form className="card" onSubmit={save}>
        <h1>Register package</h1>

        <div className="scan">
          <label className="field">
            <span>
              Tracking number <small>scan the barcode, or type it and press Enter</small>
            </span>
            <input
              ref={scanField}
              className="scan-input"
              value={trackingNumber}
              maxLength={64}
              autoFocus
              placeholder="Scan barcode…"
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={onScanKey}
              onBlur={() => void lookup()}
            />
          </label>
          <button type="button" onClick={generate}>
            No tracking number
          </button>
        </div>
        {lookupNote && <p className="message info">{lookupNote}</p>}

        <PackageForm value={details} onChange={setDetails} options={options} autoFilled={autoFilled} />

        <label className="checkbox">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Send email notification to the recipient
        </label>

        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          <button className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save and print label'}
          </button>
          <button type="button" onClick={reset} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="card">
          <h2>Just registered</h2>
          <ul className="recent">
            {recent.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.tracking_number}</strong> → {item.recipient || item.institute}
                </span>
                <a href={labelUrl([item.id])} target="_blank" rel="noreferrer">
                  Print label again
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
