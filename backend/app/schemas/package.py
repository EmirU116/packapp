import re
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, StringConstraints, model_validator

from app.models import Package
from app.models.package import EXTRA_INFORMATION_MAX, PackageStatus, PackageType, Route

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_email(value: str) -> str:
    if value and not _EMAIL_PATTERN.match(value):
        raise ValueError("Not a valid email address")
    return value


def _text(max_length: int):
    """A trimmed text field with a maximum length."""
    return Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]


# Field types shared by the create and update schemas
Text100 = _text(100)
Text50 = _text(50)
TrackingNumber = _text(64)
ExtraInformation = _text(EXTRA_INFORMATION_MAX)
Email = Annotated[Text100, AfterValidator(_check_email)]
# the form sends "" when no route is chosen
OptionalRoute = Annotated[Route | None, BeforeValidator(lambda v: None if v == "" else v)]


class PackageFields(BaseModel):
    """The details that describe a package, shared by single and multi register."""

    carrier: Text100 = ""
    package_type: PackageType
    sender: Text100 = ""
    recipient: Text100 = ""
    institute: Text100 = ""
    route: OptionalRoute = None
    su_number: Text50 = ""
    email: Email = ""
    room_number: Text50 = ""
    extra_information: ExtraInformation = ""
    # when checked, a notification is put in the outbox for `email`
    notify: bool = False

    @model_validator(mode="after")
    def _check_delivery_target(self):
        if not self.recipient and not self.institute:
            raise ValueError("Give a recipient, or an institute when there is no recipient name")
        if self.notify and not self.email:
            raise ValueError("An email address is needed to send a notification")
        return self


class PackageCreate(PackageFields):
    # left empty when the package has no tracking number; one is generated
    tracking_number: TrackingNumber = ""


class PackageBulkCreate(PackageFields):
    """Multi register: one set of details, one package per tracking number (empty = generate)."""

    tracking_numbers: list[TrackingNumber] = Field(min_length=1, max_length=200)


class PackageUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    tracking_number: Annotated[TrackingNumber, StringConstraints(min_length=1)] | None = None
    carrier: Text100 | None = None
    package_type: PackageType | None = None
    sender: Text100 | None = None
    recipient: Text100 | None = None
    institute: Text100 | None = None
    route: OptionalRoute = None
    su_number: Text50 | None = None
    email: Email | None = None
    room_number: Text50 | None = None
    extra_information: ExtraInformation | None = None
    status: PackageStatus | None = None


class PackageOut(BaseModel):
    id: int
    tracking_number: str
    carrier: str
    package_type: str
    sender: str
    recipient: str
    institute: str
    route: str | None
    su_number: str
    email: str
    room_number: str
    extra_information: str
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: str

    @classmethod
    def from_package(cls, package: Package) -> "PackageOut":
        columns = {c.name: getattr(package, c.name) for c in Package.__table__.columns}
        # show who registered it by username rather than by id
        return cls(**{**columns, "created_by": package.creator.username})


class PackagePage(BaseModel):
    items: list[PackageOut]
    total: int


class PackageOptions(BaseModel):
    """Choices for the form dropdowns, so the frontend has no hard-coded copies."""

    package_types: list[str]
    routes: list[str]
    statuses: list[str]
    extra_information_max: int


class RecipientSuggestion(BaseModel):
    """Delivery details remembered from an earlier package to the same recipient."""

    recipient: str
    institute: str
    route: str | None
    su_number: str
    email: str
    room_number: str


class TrackingLookupOut(BaseModel):
    tracking_number: str
    # field name -> value for every field the lookup could fill in
    fields: dict[str, str]
    # where the values came from: "pattern", "parcelsapp", "history"
    sources: list[str]


class GeneratedTrackingNumber(BaseModel):
    tracking_number: str


class NotificationOut(BaseModel):
    id: int
    package_id: int
    to_email: str
    subject: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}
