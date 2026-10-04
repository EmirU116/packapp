from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Package, User
from app.schemas.package import PackageFields, PackageUpdate
from app.services.notifications import queue_package_notification
from app.services.tracking_number import generate_tracking_number


def create_packages(
    db: Session, fields: PackageFields, tracking_numbers: list[str], user: User
) -> list[Package]:
    """
    Register one package per entry in `tracking_numbers`, all with the same details.

    Used by both single register (one entry) and multi register. An empty
    entry means the package has no tracking number, so one is generated.
    If `fields.notify` is set, one notification covering all the packages is
    queued. Commits and returns the new packages in the given order.
    """
    details = fields.model_dump(exclude={"notify", "tracking_number", "tracking_numbers"})
    packages = []
    for number in tracking_numbers:
        package = Package(
            tracking_number=number or generate_tracking_number(db),
            created_by=user.id,
            **details,
        )
        db.add(package)
        # flush so the next generated number is checked against this one too
        db.flush()
        packages.append(package)

    if fields.notify:
        queue_package_notification(db, packages)
    db.commit()
    return packages


def get_package(db: Session, package_id: int) -> Package:
    package = db.get(Package, package_id)
    if package is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Package not found")
    return package


def update_package(db: Session, package: Package, changes: PackageUpdate) -> Package:
    """Apply the fields that were sent, keeping the rule that a package needs a delivery target."""
    for field, value in changes.model_dump(exclude_unset=True).items():
        # null only means "clear it" for route; elsewhere it is ignored
        if value is None and field != "route":
            continue
        setattr(package, field, value)

    if not package.delivery_target:
        db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Give a recipient, or an institute when there is no recipient name",
        )
    db.commit()
    db.refresh(package)
    return package


def search_packages(
    db: Session,
    q: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Package], int]:
    """
    Find packages, newest first.

    `q` matches any part of the recipient, institute, sender (the company the
    package is from – not the carrier) or tracking number, ignoring case.
    `date_from` / `date_to` filter on the registration date, both inclusive.
    Returns one page of packages and the total number of matches.
    """
    conditions = []
    q = q.strip()
    if q:
        conditions.append(
            or_(
                *(
                    column.icontains(q, autoescape=True)
                    for column in (
                        Package.recipient,
                        Package.institute,
                        Package.sender,
                        Package.tracking_number,
                    )
                )
            )
        )
    if date_from:
        conditions.append(Package.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        # "< next day" so the whole end date is included
        conditions.append(
            Package.created_at < datetime.combine(date_to + timedelta(days=1), time.min)
        )

    total = db.scalar(select(func.count()).select_from(Package).where(*conditions)) or 0
    items = db.scalars(
        select(Package)
        .where(*conditions)
        .order_by(Package.created_at.desc(), Package.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


def suggest_recipients(db: Session, q: str, limit: int = 8) -> list[Package]:
    """
    Earlier packages whose recipient matches `q`, one per distinct recipient
    (the most recent), so the form can fill in institute, route, room etc.
    """
    recent = db.scalars(
        select(Package)
        .where(Package.recipient != "", Package.recipient.icontains(q, autoescape=True))
        .order_by(Package.created_at.desc(), Package.id.desc())
        .limit(100)
    )
    latest: dict[str, Package] = {}
    for package in recent:
        # first hit per name is the newest, because of the ordering
        latest.setdefault(package.recipient.lower(), package)
    return list(latest.values())[:limit]


def suggest_senders(db: Session, q: str, limit: int = 8) -> list[str]:
    """Distinct sender names used before that match `q`."""
    return list(
        db.scalars(
            select(Package.sender)
            .where(Package.sender != "", Package.sender.icontains(q, autoescape=True))
            .distinct()
            .order_by(Package.sender)
            .limit(limit)
        )
    )
