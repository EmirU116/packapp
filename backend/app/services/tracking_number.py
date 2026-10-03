import secrets
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Package

# No 0/O or 1/I, so a number can be read aloud or typed without mix-ups
_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
PREFIX = "PA"


def generate_tracking_number(db: Session) -> str:
    """
    Create a tracking number for a package that arrived without one.

    Format: PA-YYYYMMDD-XXXX, e.g. PA-20261003-7KQ2. The date makes the number
    easy to place, and the random part is re-drawn until it is unused.
    """
    today = date.today().strftime("%Y%m%d")
    while True:
        suffix = "".join(secrets.choice(_ALPHABET) for _ in range(4))
        number = f"{PREFIX}-{today}-{suffix}"
        # retry on the rare collision with an existing package
        if db.scalar(select(Package.id).where(Package.tracking_number == number).limit(1)) is None:
            return number
