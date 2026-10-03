import logging
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

API_URL = "https://parcelsapp.com/api/v3/shipments/tracking"
# Parcelsapp answers asynchronously: poll a few times, then give up so a
# slow lookup never blocks the person at the scanner for long
_POLL_ATTEMPTS = 3
_POLL_DELAY_SECONDS = 1.0


def lookup_parcelsapp(tracking_number: str, client: httpx.Client | None = None) -> dict[str, str]:
    """
    Ask Parcelsapp.com about a tracking number.

    Only used when PARCELSAPP_API_KEY is set. Returns the package fields it
    could determine (currently the carrier), or {} on any failure – network
    error, bad key, unknown number – so registration always falls back to
    the local lookup and manual entry.

    `client` can be passed in for testing.
    """
    own_client = client is None
    client = client or httpx.Client(timeout=5)
    try:
        response = client.post(
            API_URL,
            json={
                "apiKey": settings.parcelsapp_api_key,
                "language": "en",
                "shipments": [
                    {
                        "trackingId": tracking_number,
                        "language": "en",
                        "country": settings.parcelsapp_country,
                    }
                ],
            },
        )
        response.raise_for_status()
        data = response.json()

        # Not cached on their side: the result has to be fetched by uuid
        for _ in range(_POLL_ATTEMPTS):
            if data.get("done") or not data.get("uuid"):
                break
            time.sleep(_POLL_DELAY_SECONDS)
            response = client.get(
                API_URL, params={"uuid": data["uuid"], "apiKey": settings.parcelsapp_api_key}
            )
            response.raise_for_status()
            data = {**response.json(), "uuid": data["uuid"]}

        return _extract_fields(data)
    except (httpx.HTTPError, ValueError, AttributeError, TypeError) as error:
        logger.warning("Parcelsapp lookup failed for %s: %s", tracking_number, error)
        return {}
    finally:
        if own_client:
            client.close()


def _extract_fields(data: dict) -> dict[str, str]:
    """Pick the package fields out of a Parcelsapp response."""
    shipments = data.get("shipments") or []
    if not shipments:
        return {}
    carrier = (shipments[0].get("detectedCarrier") or {}).get("name")
    return {"carrier": carrier} if carrier else {}
