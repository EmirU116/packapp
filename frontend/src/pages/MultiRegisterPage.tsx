import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { fetchOptions, labelUrl, lookupTracking, registerPackages } from '../api/packages'
import type { Package, PackageDetails, PackageOptions } from '../api/types'
import { PackageForm } from '../components/PackageForm'
import { checkDetails, describeLookup, EMPTY_DETAILS, messageOf } from '../components/packageDetails'

/**
 * Multi register: several packages that share the same details.
 *
 * Scan each package to add it to the list (the same number may be scanned
 * several times; packages without a number get one created). After saving,
 * choose how to print: a paper list, a label per package, or one label
 * showing the number of packages.
 */
export function MultiRegisterPage() {
  const [options, setOptions] = useState<PackageOptions | null>(null)
  const [scan, setScan] = useState('')
  // '' stands for a package without a tracking number
  const [numbers, setNumbers] = useState<string[]>([])
  const [details, setDetails] = useState<PackageDetails>(EMPTY_DETAILS)
  const [notify, setNotify] = useState(false)
  const [autoFilled, setAutoFilled] = useState<ReadonlySet<string>>(new Set())
  const [lookupNote, setLookupNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Package[] | null>(null)

  const scanField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch((caught: Error) => setError(caught.message))
  }, [])

  const addScanned = async () => {
    const number = scan.trim()
    if (!number) return
    const isFirst = numbers.length === 0
    setNumbers((list) => [...list, number])
    setScan('')

    // the first scan fills in the shared details, like single register
    if (!isFirst) return
    try {
      const { fields } = await lookupTracking(number)
      setDetails((current) => ({ ...current, ...fields }))
      setAutoFilled(new Set(Object.keys(fields)))
      setLookupNote(describeLookup(fields))
    } catch {
      setLookupNote('Lookup is unavailable – fill in the details by hand.')
    }
  }

  const onScanKey = (event: KeyboardEvent<HTMLInputElement>) => {
    // scanner Enter adds the package instead of saving the form
    if (event.key === 'Enter') {
      event.preventDefault()
      void addScanned()
    }
  }

  const removeAt = (index: number) => setNumbers((list) => list.filter((_, i) => i !== index))

  const reset = () => {
    setScan('')
    setNumbers([])
    setDetails(EMPTY_DETAILS)
    setNotify(false)
    setAutoFilled(new Set())
    setLookupNote('')
    setError('')
    setSaved(null)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const problem = numbers.length === 0 ? 'Add at least one package.' : checkDetails(details, notify)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      setSaved(await registerPackages(details, numbers, notify))
    } catch (caught) {
      setError(messageOf(caught, 'Could not save the packages'))
    } finally {
      setSaving(false)
    }
  }

  if (!options) {
    return error ? <p className="message error">{error}</p> : <p>Loading…</p>
  }

  // after saving: choose what to print
  if (saved) {
    const ids = saved.map((item) => item.id)
    return (
      <section className="card">
        <h1>{saved.length} packages registered</h1>
        <p>
          For <strong>{saved[0].recipient || saved[0].institute}</strong>. Choose what to print:
        </p>
        <div className="print-choices">
          <a className="button" href={labelUrl(ids, 'list')} target="_blank" rel="noreferrer">
            Paper list
            <small>one A4 page listing all the packages</small>
          </a>
          <a className="button" href={labelUrl(ids, 'labels')} target="_blank" rel="noreferrer">
            Label per package
            <small>{saved.length} labels</small>
          </a>
          <a className="button" href={labelUrl(ids, 'summary')} target="_blank" rel="noreferrer">
            One label with the count
            <small>a single label showing {saved.length} packages</small>
          </a>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={reset}>
            Register more packages
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className="card" onSubmit={save}>
      <h1>Multi register</h1>

      <div className="scan">
        <label className="field">
          <span>
            Add package <small>scan each barcode, or type the number and press Enter</small>
          </span>
          <input
            ref={scanField}
            className="scan-input"
            value={scan}
            maxLength={64}
            autoFocus
            placeholder="Scan barcode…"
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={onScanKey}
          />
        </label>
        <button type="button" onClick={() => void addScanned()}>
          Add
        </button>
        <button type="button" onClick={() => setNumbers((list) => [...list, ''])}>
          Add without number
        </button>
      </div>

      <p className="count">
        <strong>{numbers.length}</strong> {numbers.length === 1 ? 'package' : 'packages'} in this registration
      </p>
      {numbers.length > 0 && (
        <ol className="numbers">
          {numbers.map((number, index) => (
            // the same number can appear more than once, so the position is the key
            <li key={index}>
              <span>{number || <em>number will be created</em>}</span>
              <button type="button" className="small" onClick={() => removeAt(index)}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
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
          {saving ? 'Saving…' : `Save ${numbers.length || ''} packages`.replace('  ', ' ')}
        </button>
        <button type="button" onClick={reset} disabled={saving}>
          Clear
        </button>
      </div>
    </form>
  )
}
