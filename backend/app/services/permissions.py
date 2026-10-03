from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Permission, Role, User
from app.services.auth import get_current_user

# Permission codes. New ones must also be added to PERMISSIONS in app/seed.py.
PACKAGE_REGISTER = "package.register"
PACKAGE_UPDATE = "package.update"
PACKAGE_DELETE = "package.delete"
RBAC_MANAGE = "rbac.manage"


def require_permission(code: str) -> Callable[..., User]:
    """
    Build a FastAPI dependency that only lets users with `code` through.

    Usage: `user: User = Depends(require_permission(PACKAGE_DELETE))`.
    The check reads the role's permissions from the database, so changes
    made by the Chief apply on the very next request.
    """

    def dependency(user: User = Depends(get_current_user)) -> User:
        if code not in {p.code for p in user.role.permissions}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {code}")
        return user

    return dependency


def ensure_rbac_manager_remains(db: Session) -> None:
    """
    Guard against locking everyone out of role management.

    Call after changing roles or users but before committing. If the pending
    change would leave no active user with `rbac.manage`, the change is
    rolled back and a 400 is raised.
    """
    db.flush()
    managers = db.scalar(
        select(func.count(User.id))
        .join(User.role)
        .join(Role.permissions)
        .where(User.is_active, Permission.code == RBAC_MANAGE)
    )
    if not managers:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "At least one active user must keep the permission to manage roles",
        )
