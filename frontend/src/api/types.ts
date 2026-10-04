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
