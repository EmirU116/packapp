# Packages: register, update, delete, search

All endpoints need a login. Changing data also needs the matching permission (see [auth-and-roles.md](auth-and-roles.md)).

| Endpoint | Permission | What it does |
|---|---|---|
| `POST /api/packages` | `package.register` | Single register: save one package |
| `POST /api/packages/bulk` | `package.register` | Multi register: several packages with the same details |
| `GET /api/packages` | any logged-in user | Search |
| `GET /api/packages/{id}` | any logged-in user | One package |
| `PATCH /api/packages/{id}` | `package.update` | Change the fields that are sent |
| `DELETE /api/packages/{id}` | `package.delete` | Delete |
| `GET /api/packages/options` | any logged-in user | Choices for package type, route, status |
| `GET /api/packages/suggest/recipients?q=` | any logged-in user | Recipients seen before, with their details |
| `GET /api/packages/suggest/senders?q=` | any logged-in user | Sender names used before |
| `GET /api/notifications` | any logged-in user | The local email outbox |

## Fields and rules

| Field | Rule |
|---|---|
| `tracking_number` | Optional. Left empty → the system generates one (see [tracking.md](tracking.md)). Not unique: several packages of one shipment can share a number. |
| `carrier` | Who drove the package. |
| `package_type` | Required. One of: Cold, Parcel, Frozen, Multiple temperatures, REK letter, Pallet, EXT. |
| `sender` | The company the package is from. |
| `recipient` / `institute` | At least one is required. With no recipient name, the institute is the delivery target. |
| `route` | Optional. One of: ABC, DEF, MBW, Arrenhius, Biblotek. |
| `su_number`, `room_number` | Optional. |
| `email` | Optional, must look like an email address. |
| `extra_information` | Optional, at most **120 characters** so it fits its box on the label. |
| `status` | `registered` when created; can be changed to `delivered`. |
| `created_at`, `updated_at` | Set automatically, in this machine's local time. |
| `created_by` | The user who registered it. |

Invalid input is refused with status 422 and a message saying which field is wrong.

## Email notification

Sending `"notify": true` when registering puts a message in the local outbox for the package's `email`. Without it, nothing is created. A multi register produces one message for the whole batch.

**No real email is sent in the MVP.** The outbox (`GET /api/notifications`) shows what would have been sent. To send for real later, replace the body of `queue_package_notification` in `app/services/notifications.py`.

## Multi register

`POST /api/packages/bulk` takes the same fields as single register, but a list `tracking_numbers` instead of one number. One package is created per entry:

- an empty entry gets a generated number
- the same number may appear several times (several boxes on one tracking number)

The three print outputs (list, labels, summary label) come with the label feature.

## Search

`GET /api/packages?q=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&limit=50&offset=0`

- `q` matches any part of the **recipient**, **institute**, **sender** or **tracking number**, ignoring case. It does not match the carrier – searching by company means the sender.
- `date_from` and `date_to` filter on the registration date; both days are included.
- Results are newest first. The answer contains `items` (one page) and `total` (all matches).

The searched columns are indexed in the database.

## Suggestions

To cut down typing, the form can ask for recipients registered before (`suggest/recipients`). Each suggestion carries the institute, route, SU number, email and room number from the most recent package to that person.
