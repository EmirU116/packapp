from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Permission, Role, User
from app.schemas.admin import (
    PermissionOut,
    RoleCreate,
    RoleOut,
    RolePermissionsUpdate,
    UserCreate,
    UserUpdate,
)
from app.schemas.auth import UserOut
from app.services.auth import hash_password
from app.services.permissions import (
    RBAC_MANAGE,
    ensure_rbac_manager_remains,
    require_permission,
)

# Everything here is role management, so the whole router needs rbac.manage
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_permission(RBAC_MANAGE))],
)


def _role_out(role: Role) -> RoleOut:
    return RoleOut(id=role.id, name=role.name, permissions=[p.code for p in role.permissions])


def _permissions_by_code(db: Session, codes: list[str]) -> list[Permission]:
    """Look up permissions by code; raises 400 if any code does not exist."""
    found = list(db.scalars(select(Permission).where(Permission.code.in_(codes))))
    unknown = set(codes) - {p.code for p in found}
    if unknown:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unknown permission: {', '.join(sorted(unknown))}"
        )
    return found


def _get_or_404(db: Session, model: type, item_id: int):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
    return item


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(db: Session = Depends(get_db)):
    return db.scalars(select(Permission).order_by(Permission.code)).all()


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return [_role_out(r) for r in db.scalars(select(Role).order_by(Role.id))]


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(body: RoleCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Role).where(Role.name == body.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with that name already exists")
    role = Role(name=body.name, permissions=_permissions_by_code(db, body.permissions))
    db.add(role)
    db.commit()
    return _role_out(role)


@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
def set_role_permissions(role_id: int, body: RolePermissionsUpdate, db: Session = Depends(get_db)):
    """Replace a role's permissions with the given list (the dynamic RBAC)."""
    role = _get_or_404(db, Role, role_id)
    role.permissions = _permissions_by_code(db, body.permissions)
    ensure_rbac_manager_remains(db)
    db.commit()
    db.refresh(role)
    return _role_out(role)


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return [UserOut.from_user(u) for u in db.scalars(select(User).order_by(User.username))]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")
    user = User(
        username=body.username,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=_get_or_404(db, Role, body.role_id),
    )
    db.add(user)
    db.commit()
    return UserOut.from_user(user)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    """Change a user's name, password, role or active state."""
    user = _get_or_404(db, User, user_id)
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.role_id is not None:
        user.role = _get_or_404(db, Role, body.role_id)
    if body.is_active is not None:
        user.is_active = body.is_active
    ensure_rbac_manager_remains(db)
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)
