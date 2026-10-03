from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User

# Keeps the text inside its box on the label
EXTRA_INFORMATION_MAX = 120


class PackageType(StrEnum):
    COLD = "Cold"
    PARCEL = "Parcel"
    FROZEN = "Frozen"
    MULTIPLE_TEMPERATURES = "Multiple temperatures"
    REK_LETTER = "REK letter"
    PALLET = "Pallet"
    EXT = "EXT"


class Route(StrEnum):
    ABC = "ABC"
    DEF = "DEF"
    MBW = "MBW"
    ARRENHIUS = "Arrenhius"
    BIBLOTEK = "Biblotek"


class PackageStatus(StrEnum):
    REGISTERED = "registered"
    DELIVERED = "delivered"


def local_now() -> datetime:
    # Local time of this machine: the app is local, and date filters and
    # printed dates should match the wall clock at the goods reception.
    return datetime.now().replace(microsecond=0)


class Package(Base):
    """
    A registered package.

    `tracking_number` is deliberately not unique: one shipment can consist of
    several packages that share a number (see multi register).
    `carrier` is who drove the package; `sender` is the company it is from.
    """

    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracking_number: Mapped[str] = mapped_column(String(64), index=True)
    carrier: Mapped[str] = mapped_column(String(100), default="")
    package_type: Mapped[str] = mapped_column(String(30))
    sender: Mapped[str] = mapped_column(String(100), default="", index=True)
    recipient: Mapped[str] = mapped_column(String(100), default="", index=True)
    institute: Mapped[str] = mapped_column(String(100), default="")
    route: Mapped[str | None] = mapped_column(String(30), default=None)
    su_number: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(100), default="")
    room_number: Mapped[str] = mapped_column(String(50), default="")
    extra_information: Mapped[str] = mapped_column(String(EXTRA_INFORMATION_MAX), default="")
    status: Mapped[str] = mapped_column(String(20), default=PackageStatus.REGISTERED)
    created_at: Mapped[datetime] = mapped_column(default=local_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=local_now, onupdate=local_now)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    creator: Mapped[User] = relationship(lazy="joined")
    # removing a package also removes its outbox entries
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        back_populates="package", cascade="all, delete-orphan"
    )

    @property
    def delivery_target(self) -> str:
        """Who the package goes to: the recipient, or the institute when no name is known."""
        return self.recipient or self.institute
