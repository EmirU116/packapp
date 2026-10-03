from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.package import Package, local_now


class Notification(Base):
    """
    An email notification in the local outbox.

    The MVP does not send real email; rows here are what would have been sent.
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"))
    to_email: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=local_now)

    package: Mapped[Package] = relationship(back_populates="notifications")
