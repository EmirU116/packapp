import { api } from './client'
import type {
  Package,
  PackageInput,
  PackageOptions,
  RecipientSuggestion,
  TrackingLookup,
} from './types'

export const fetchOptions = () => api<PackageOptions>('/api/packages/options')

export const registerPackage = (input: PackageInput) =>
  api<Package>('/api/packages', { method: 'POST', body: input })

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
