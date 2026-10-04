import { useState } from 'react'
import type { FormEvent } from 'react'
import { updatePackage } from '../api/packages'
import type { Package, PackageOptions } from '../api/types'
import { PackageForm } from './PackageForm'
import { checkDetails, detailsOf, messageOf } from './packageDetails'

interface Props {
  item: Package
  options: PackageOptions
  onSaved: (updated: Package) => void
  onCancel: () => void
}

/** Edit form for an existing package: tracking number, status and the shared details. */
export function EditPackage({ item, options, onSaved, onCancel }: Props) {
  const [trackingNumber, setTrackingNumber] = useState(item.tracking_number)
  const [status, setStatus] = useState(item.status)
  const [details, setDetails] = useState(detailsOf(item))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const problem = !trackingNumber.trim() ? 'The tracking number cannot be empty.' : checkDetails(details, false)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      onSaved(await updatePackage(item.id, { ...details, tracking_number: trackingNumber.trim(), status }))
    } catch (caught) {
      setError(messageOf(caught, 'Could not save the changes'))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={save} aria-label="Edit package">
      <h2>Edit package #{item.id}</h2>
      <div className="grid">
        <label className="field">
          Tracking number
          <input value={trackingNumber} maxLength={64} onChange={(e) => setTrackingNumber(e.target.value)} />
        </label>
        <label className="field">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {options.statuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <PackageForm value={details} onChange={setDetails} options={options} />

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
