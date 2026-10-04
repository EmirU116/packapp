import type { PackageDetails } from '../api/types'

/** A blank form. Parcel is preselected because it is the most common type. */
export const EMPTY_DETAILS: PackageDetails = {
  carrier: '',
  package_type: 'Parcel',
  sender: '',
  recipient: '',
  institute: '',
  route: '',
  su_number: '',
  email: '',
  room_number: '',
  extra_information: '',
}
