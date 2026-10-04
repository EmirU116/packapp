from sqlalchemy.orm import Session

from app.models import Notification, Package


def queue_package_notification(db: Session, packages: list[Package]) -> Notification:
    """
    Put one "your package has arrived" message in the local outbox.

    `packages` are the packages registered together for the same recipient;
    a multi register produces a single message that mentions the count.
    Nothing is actually emailed in the MVP – replace this function's body
    with a real mail sender later.
    """
    first = packages[0]
    count = len(packages)
    what = "A package has" if count == 1 else f"{count} packages have"
    lines = [
        f"Hello {first.delivery_target},",
        "",
        f"{what} arrived for you at the goods reception.",
        f"From: {first.sender or 'unknown sender'}",
        f"Type: {first.package_type}",
        f"Tracking number: {', '.join(sorted({p.tracking_number for p in packages}))}",
    ]
    notification = Notification(
        package=first,
        to_email=first.email,
        subject=f"{what} arrived for you",
        body="\n".join(lines),
    )
    db.add(notification)
    return notification
