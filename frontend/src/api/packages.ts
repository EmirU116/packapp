import { api } from './client'
import type {
  OutboxMessage,
  Package,
  PackageDetails,
  PackageInput,
  PackageOptions,
  PackagePage,
  PackageUpdate,
  RecipientSuggestion,
  SearchParams,
  TrackingLookup,
} from './types'

export const fetchOptions = () => api<PackageOptions>('/api/packages/options')

export const registerPackage = (input: PackageInput) =>
  api<Package>('/api/packages', { method: 'POST', body: input })

/** Multi register: one package per tracking number, all with the same details. */
export const registerPackages = (details: PackageDetails, trackingNumbers: string[], notify: boolean) =>
  api<Package[]>('/api/packages/bulk', {
    method: 'POST',
    body: { ...details, tracking_numbers: trackingNumbers, notify },
  })

export function searchPackages({ q, dateFrom, dateTo, limit = 25, offset = 0 }: SearchParams) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  // only send the filters that are filled in
  if (q) query.set('q', q)
  if (dateFrom) query.set('date_from', dateFrom)
  if (dateTo) query.set('date_to', dateTo)
  return api<PackagePage>(`/api/packages?${query}`)
}

export const updatePackage = (id: number, changes: PackageUpdate) =>
  api<Package>(`/api/packages/${id}`, { method: 'PATCH', body: changes })

export const deletePackage = (id: number) => api<null>(`/api/packages/${id}`, { method: 'DELETE' })

export const fetchOutbox = () => api<OutboxMessage[]>('/api/notifications')

export const lookupTracking = (trackingNumber: string) =>
  api<TrackingLookup>(`/api/tracking/lookup/${encodeURIComponent(trackingNumber)}`)

export const generateTrackingNumber = () =>
  api<{ tracking_number: string }>('/api/tracking/generate')

export const suggestRecipients = (q: string) =>
  api<RecipientSuggestion[]>(`/api/packages/suggest/recipients?q=${encodeURIComponent(q)}`)

export const suggestSenders = (q: string) =>
  api<string[]>(`/api/packages/suggest/senders?q=${encodeURIComponent(q)}`)

export type LabelOutput = 'labels' | 'summary' | 'list'

/** Address of the printable PDF for the given packages. */
export function labelUrl(ids: number[], output: LabelOutput = 'labels'): string {
  const query = ids.map((id) => `ids=${id}`).join('&')
  return `/api/labels?${query}&output=${output}`
}
