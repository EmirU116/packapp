from sqlalchemy.orm import Session

from app.config import settings
from app.services.tracking.local import detect_carrier, lookup_history
from app.services.tracking.parcelsapp import lookup_parcelsapp


def lookup_tracking(db: Session, tracking_number: str) -> tuple[dict[str, str], list[str]]:
    """
    Collect everything that can be auto-filled for a scanned tracking number.

    Sources are tried from least to most trusted, later ones overriding
    earlier ones:
      1. "pattern"    – carrier guessed from the shape of the number
      2. "parcelsapp" – Parcelsapp.com, only when an API key is configured
      3. "history"    – details of an earlier package with the same number
    Returns (field name -> value, names of the sources that contributed).
    To add a source, write a function returning a dict of package fields and
    add it here.
    """
    fields: dict[str, str] = {}
    sources: list[str] = []

    carrier = detect_carrier(tracking_number)
    if carrier:
        fields["carrier"] = carrier
        sources.append("pattern")

    if settings.parcelsapp_api_key:
        remote = lookup_parcelsapp(tracking_number)
        if remote:
            fields.update(remote)
            sources.append("parcelsapp")

    history = lookup_history(db, tracking_number)
    if history:
        fields.update(history)
        sources.append("history")

    return fields, sources
