import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Package

# Well-known tracking number shapes. A best-effort guess: some shapes are
# shared between carriers, so the user can always correct the carrier.
_CARRIER_PATTERNS = [
    (re.compile(r"^1Z[0-9A-Z]{16}$"), "UPS"),
    # S10 international postal format; the last two letters are the country
    (re.compile(r"^[A-Z]{2}\d{9}SE$"), "PostNord"),
    (re.compile(r"^JJD\d{10,}$"), "DHL"),
    (re.compile(r"^\d{10}$"), "DHL"),
    (re.compile(r"^(\d{12}|\d{15})$"), "FedEx"),
]

# Fields copied from an earlier package with the same tracking number
_HISTORY_FIELDS = (
    "carrier",
    "package_type",
    "sender",
    "recipient",
    "institute",
    "route",
    "su_number",
    "email",
    "room_number",
)


def detect_carrier(tracking_number: str) -> str | None:
    """Guess the carrier from the shape of the tracking number, or None if unknown."""
    normalized = re.sub(r"\s+", "", tracking_number).upper()
    for pattern, carrier in _CARRIER_PATTERNS:
        if pattern.match(normalized):
            return carrier
    return None


def lookup_history(db: Session, tracking_number: str) -> dict[str, str]:
    """
    Details of the most recent package registered with the same tracking
    number (ignoring case), e.g. the next box of a multi-package shipment.
    Empty values are left out. Returns {} when the number is new.
    """
    previous = db.scalar(
        select(Package)
        .where(func.lower(Package.tracking_number) == tracking_number.lower())
        .order_by(Package.created_at.desc(), Package.id.desc())
        .limit(1)
    )
    if previous is None:
        return {}
    values = {field: getattr(previous, field) for field in _HISTORY_FIELDS}
    return {field: value for field, value in values.items() if value}
