from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.models.package import EXTRA_INFORMATION_MAX, PackageStatus, PackageType, Route
from app.schemas.package import (
    PackageBulkCreate,
    PackageCreate,
    PackageOptions,
    PackageOut,
    PackagePage,
    PackageUpdate,
    RecipientSuggestion,
)
from app.services import packages as service
from app.services.auth import get_current_user
from app.services.permissions import (
    PACKAGE_DELETE,
    PACKAGE_REGISTER,
    PACKAGE_UPDATE,
    require_permission,
)

# Reading and searching is open to every logged-in user; changes need a permission
router = APIRouter(
    prefix="/api/packages", tags=["packages"], dependencies=[Depends(get_current_user)]
)


@router.get("/options", response_model=PackageOptions)
def options():
    return PackageOptions(
        package_types=list(PackageType),
        routes=list(Route),
        statuses=list(PackageStatus),
        extra_information_max=EXTRA_INFORMATION_MAX,
    )


@router.get("/suggest/recipients", response_model=list[RecipientSuggestion])
def suggest_recipients(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    """Recipients seen before, with their delivery details, for auto-filling the form."""
    return [
        RecipientSuggestion.model_validate(p, from_attributes=True)
        for p in service.suggest_recipients(db, q)
    ]


@router.get("/suggest/senders", response_model=list[str])
def suggest_senders(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    return service.suggest_senders(db, q)


@router.post("", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
def register_package(
    body: PackageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(PACKAGE_REGISTER)),
):
    """Single register: save one package."""
    (package,) = service.create_packages(db, body, [body.tracking_number], user)
    return PackageOut.from_package(package)


@router.post("/bulk", response_model=list[PackageOut], status_code=status.HTTP_201_CREATED)
def register_packages(
    body: PackageBulkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(PACKAGE_REGISTER)),
):
    """Multi register: save several packages that share the same details."""
    packages = service.create_packages(db, body, body.tracking_numbers, user)
    return [PackageOut.from_package(p) for p in packages]


@router.get("", response_model=PackagePage)
def search_packages(
    q: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = service.search_packages(db, q, date_from, date_to, limit, offset)
    return PackagePage(items=[PackageOut.from_package(p) for p in items], total=total)


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: Session = Depends(get_db)):
    return PackageOut.from_package(service.get_package(db, package_id))


@router.patch(
    "/{package_id}",
    response_model=PackageOut,
    dependencies=[Depends(require_permission(PACKAGE_UPDATE))],
)
def update_package(package_id: int, body: PackageUpdate, db: Session = Depends(get_db)):
    package = service.update_package(db, service.get_package(db, package_id), body)
    return PackageOut.from_package(package)


@router.delete(
    "/{package_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(PACKAGE_DELETE))],
)
def delete_package(package_id: int, db: Session = Depends(get_db)) -> None:
    db.delete(service.get_package(db, package_id))
    db.commit()
