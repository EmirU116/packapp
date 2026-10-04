import type { Package, PackageOptions } from '../api/types'

// Sample data shared by the page tests

export const OPTIONS: PackageOptions = {
  package_types: ['Cold', 'Parcel', 'Frozen'],
  routes: ['ABC', 'DEF'],
  statuses: ['registered', 'delivered'],
  extra_information_max: 120,
}

/** A saved package; pass the fields that should differ. */
export function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    id: 1,
    tracking_number: 'TRACK-001',
    carrier: 'UPS',
    package_type: 'Parcel',
    sender: 'Sigma Aldrich',
    recipient: 'Anna Berg',
    institute: 'Chemistry',
    route: 'ABC',
    su_number: '',
    email: '',
    room_number: 'C412',
    extra_information: '',
    status: 'registered',
    created_at: '2026-10-04T12:30:00',
    updated_at: '2026-10-04T12:30:00',
    created_by: 'employee',
    ...overrides,
  }
}
