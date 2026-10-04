import type { Package, PackageDetails } from '../api/types'

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

// Readable names for the fields the lookup can fill in
const FIELD_NAMES: Record<string, string> = {
  carrier: 'carrier',
  package_type: 'type',
  sender: 'from',
  recipient: 'recipient',
  institute: 'institute',
  route: 'route',
  su_number: 'SU number',
  email: 'email',
  room_number: 'room number',
}

/** The line shown after a lookup, saying what was filled in. */
export function describeLookup(fields: Partial<PackageDetails>): string {
  const found = Object.keys(fields)
  return found.length
    ? `Filled in automatically: ${found.map((f) => FIELD_NAMES[f] ?? f).join(', ')}. Check and correct if needed.`
    : 'Nothing found for this number – fill in the details by hand.'
}

/**
 * Check the rules the form can check itself, before asking the backend.
 * Returns the problem as a sentence, or '' when everything is fine.
 */
export function checkDetails(details: PackageDetails, notify: boolean): string {
  if (!details.recipient.trim() && !details.institute.trim()) {
    return 'Give a recipient, or an institute when there is no recipient name.'
  }
  if (notify && !details.email.trim()) {
    return 'An email address is needed to send a notification.'
  }
  return ''
}

/** The editable part of a saved package, in the shape the form uses. */
export function detailsOf(item: Package): PackageDetails {
  return {
    carrier: item.carrier,
    package_type: item.package_type,
    sender: item.sender,
    recipient: item.recipient,
    institute: item.institute,
    route: item.route ?? '',
    su_number: item.su_number,
    email: item.email,
    room_number: item.room_number,
    extra_information: item.extra_information,
  }
}

/** Short text for an error of unknown type. */
export function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
