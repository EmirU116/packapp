# Tracking lookup and generated tracking numbers

## Auto-fill after a scan

`GET /api/tracking/lookup/{tracking_number}` is step 2 of the workflow: it returns every field the system can fill in for a scanned number.

```json
{
  "tracking_number": "1Z999AA10123456784",
  "fields": { "carrier": "UPS" },
  "sources": ["pattern"]
}
```

`fields` only contains what was found. If nothing is found it is empty and the user fills the form in by hand – manual registration always works.

Three sources are combined. A later source overrides an earlier one:

| Source | What it knows | Needs |
|---|---|---|
| `pattern` | The carrier, guessed from the shape of the number (UPS, PostNord, DHL, FedEx). A best-effort guess. | Nothing – always on |
| `parcelsapp` | The carrier according to Parcelsapp.com. | An API key and internet |
| `history` | Everything from the most recent package with the same number: carrier, type, sender, recipient, institute, route, SU number, email, room. Useful when a shipment arrives as several boxes. | Nothing – always on |

## Turning on Parcelsapp

The app runs fully locally by default. To also ask Parcelsapp.com, put your key in `backend/.env`:

```
PARCELSAPP_API_KEY=your-key
PARCELSAPP_COUNTRY=Sweden
```

and restart the server. If Parcelsapp is slow, down or does not know the number, the lookup quietly falls back to the local sources.

> **Not yet verified against the live service.** The Parcelsapp code is written from their API description and tested only against faked responses, because no API key was available. Expect to adjust `app/services/tracking/parcelsapp.py` once a real key is tried. It currently reads only the carrier.

## Packages without a tracking number

`GET /api/tracking/generate` returns a new number, and registering a package with an empty tracking number does the same automatically.

Format: `PA-YYYYMMDD-XXXX`, for example `PA-20261003-7KQ2`. The four characters avoid look-alikes (no 0/O, no 1/I) and the number is checked to be unused.

## For developers

- Add a carrier shape: `_CARRIER_PATTERNS` in `app/services/tracking/local.py`.
- Add a lookup source: write a function returning a dict of package fields and call it in `lookup_tracking` in `app/services/tracking/__init__.py`.
