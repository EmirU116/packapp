import { useCallback, useEffect, useState } from 'react'
import { deletePackage, fetchOptions, labelUrl, searchPackages, updatePackage } from '../api/packages'
import type { Package, PackageOptions, PackagePage } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EditPackage } from '../components/EditPackage'
import { messageOf } from '../components/packageDetails'
import { useDebounced } from '../hooks/useDebounced'

const PAGE_SIZE = 25

/** "2026-10-04T12:30:00" → "2026-10-04 12:30" */
const formatTime = (iso: string) => iso.replace('T', ' ').slice(0, 16)

/**
 * Search packages by recipient, institute, sender or tracking number, with
 * a date filter. Results update while typing. Each row can be edited,
 * reprinted, marked delivered or deleted, depending on the user's role.
 */
export function SearchPage() {
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<PackagePage | null>(null)
  const [options, setOptions] = useState<PackageOptions | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Package | null>(null)
  // id of the package whose delete button is waiting for confirmation
  const [confirming, setConfirming] = useState<number | null>(null)
  // bumped to reload the current page after a change
  const [version, setVersion] = useState(0)

  const debouncedQ = useDebounced(q.trim())

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    // ignore an answer that arrives after a newer search was started
    let current = true
    searchPackages({ q: debouncedQ, dateFrom, dateTo, limit: PAGE_SIZE, offset })
      .then((result) => {
        if (!current) return
        setPage(result)
        setError('')
      })
      .catch((caught) => current && setError(messageOf(caught, 'Search failed')))
    return () => {
      current = false
    }
  }, [debouncedQ, dateFrom, dateTo, offset, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  /** Change a filter and go back to the first page. */
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setOffset(0)
  }

  const toggleDelivered = async (item: Package) => {
    try {
      await updatePackage(item.id, { status: item.status === 'delivered' ? 'registered' : 'delivered' })
      reload()
    } catch (caught) {
      setError(messageOf(caught, 'Could not update the package'))
    }
  }

  const remove = async (item: Package) => {
    try {
      await deletePackage(item.id)
      setConfirming(null)
      // deleting the only row of a later page: step back so the page is not empty
      if (page && page.items.length === 1 && offset > 0) setOffset(offset - PAGE_SIZE)
      else reload()
    } catch (caught) {
      setError(messageOf(caught, 'Could not delete the package'))
    }
  }

  const total = page?.total ?? 0
  const first = total === 0 ? 0 : offset + 1
  const last = Math.min(offset + PAGE_SIZE, total)

  return (
    <>
      {editing && options && (
        <EditPackage
          key={editing.id}
          item={editing}
          options={options}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      <section className="card">
        <h1>Search packages</h1>
        <div className="filters">
          <label className="field">
            <span>
              Search <small>recipient, institute, sender or tracking number</small>
            </span>
            <input type="search" value={q} autoFocus onChange={(e) => filter(setQ)(e.target.value)} />
          </label>
          <label className="field">
            From date
            <input type="date" value={dateFrom} onChange={(e) => filter(setDateFrom)(e.target.value)} />
          </label>
          <label className="field">
            To date
            <input type="date" value={dateTo} onChange={(e) => filter(setDateTo)(e.target.value)} />
          </label>
        </div>

        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}

        {page && page.items.length === 0 && <p className="message info">No packages match.</p>}

        {page && page.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Registered</th>
                  <th>Tracking number</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTime(item.created_at)}</td>
                    <td>{item.tracking_number}</td>
                    <td>{item.sender}</td>
                    <td>
                      {item.recipient || item.institute}
                      {item.recipient && item.institute && <small> {item.institute}</small>}
                    </td>
                    <td>{item.room_number}</td>
                    <td>{item.package_type}</td>
                    <td>
                      <span className={`badge ${item.status}`}>{item.status}</span>
                    </td>
                    <td className="row-actions">
                      {confirming === item.id ? (
                        <>
                          <button type="button" className="small danger" onClick={() => void remove(item)}>
                            Confirm delete
                          </button>
                          <button type="button" className="small" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <a className="button small" href={labelUrl([item.id])} target="_blank" rel="noreferrer">
                            Label
                          </a>
                          {can('package.update') && (
                            <>
                              <button type="button" className="small" onClick={() => setEditing(item)}>
                                Edit
                              </button>
                              <button type="button" className="small" onClick={() => void toggleDelivered(item)}>
                                {item.status === 'delivered' ? 'Undo delivered' : 'Delivered'}
                              </button>
                            </>
                          )}
                          {can('package.delete') && (
                            <button type="button" className="small" onClick={() => setConfirming(item.id)}>
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page && total > 0 && (
          <div className="pager">
            <span>
              {first}–{last} of {total}
            </span>
            <button type="button" disabled={offset === 0} onClick={() => setOffset(offset - PAGE_SIZE)}>
              Previous
            </button>
            <button type="button" disabled={last >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </button>
          </div>
        )}
      </section>
    </>
  )
}
