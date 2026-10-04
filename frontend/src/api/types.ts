// Shapes of the data exchanged with the backend (see backend/app/schemas)

export type Permission = 'package.register' | 'package.update' | 'package.delete' | 'rbac.manage'

export interface User {
  id: number
  username: string
  full_name: string
  is_active: boolean
  role_id: number
  role: string
  permissions: string[]
}

/** The editable details of a package – what the register form holds. */
export interface PackageDetails {
  carrier: string
  package_type: string
  sender: string
  recipient: string
  institute: string
  route: string
  su_number: string
  email: string
  room_number: string
  extra_information: string
}

export interface PackageInput extends PackageDetails {
  tracking_number: string
  notify: boolean
}

export interface Package extends Omit<PackageDetails, 'route'> {
  id: number
  tracking_number: string
  route: string | null
  status: string
  created_at: string
  updated_at: string
  created_by: string
}

export interface PackageOptions {
  package_types: string[]
  routes: string[]
  statuses: string[]
  extra_information_max: number
}

export interface TrackingLookup {
  tracking_number: string
  fields: Partial<PackageDetails>
  sources: string[]
}

export interface RecipientSuggestion {
  recipient: string
  institute: string
  route: string | null
  su_number: string
  email: string
  room_number: string
}

export interface PackagePage {
  items: Package[]
  total: number
}

/** Changes to a package; only the fields present are changed. */
export interface PackageUpdate extends Partial<PackageDetails> {
  tracking_number?: string
  status?: string
}

export interface SearchParams {
  q?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export interface Role {
  id: number
  name: string
  permissions: string[]
}

export interface PermissionInfo {
  code: string
  description: string
}

export interface OutboxMessage {
  id: number
  package_id: number
  to_email: string
  subject: string
  body: string
  created_at: string
}
