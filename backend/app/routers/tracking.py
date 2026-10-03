from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.package import GeneratedTrackingNumber, TrackingLookupOut
from app.services.permissions import PACKAGE_REGISTER, require_permission
from app.services.tracking import lookup_tracking
from app.services.tracking_number import generate_tracking_number

# Both endpoints are part of registering a package
router = APIRouter(
    prefix="/api/tracking",
    tags=["tracking"],
    dependencies=[Depends(require_permission(PACKAGE_REGISTER))],
)


@router.get("/generate", response_model=GeneratedTrackingNumber)
def generate(db: Session = Depends(get_db)):
    """A new tracking number for a package that has none."""
    return GeneratedTrackingNumber(tracking_number=generate_tracking_number(db))


# :path so numbers containing "/" still reach the lookup
@router.get("/lookup/{tracking_number:path}", response_model=TrackingLookupOut)
def lookup(tracking_number: str, db: Session = Depends(get_db)):
    """Step 2 of the workflow: what can be filled in automatically for a scanned number."""
    tracking_number = tracking_number.strip()
    fields, sources = lookup_tracking(db, tracking_number)
    return TrackingLookupOut(tracking_number=tracking_number, fields=fields, sources=sources)
