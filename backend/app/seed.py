from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Permission, Role, User
from app.services.auth import hash_password
from app.services.permissions import (
    PACKAGE_DELETE,
    PACKAGE_REGISTER,
    PACKAGE_UPDATE,
    RBAC_MANAGE,
)

PERMISSIONS = {
    PACKAGE_REGISTER: "Register packages",
    PACKAGE_UPDATE: "Update packages",
    PACKAGE_DELETE: "Delete packages",
    RBAC_MANAGE: "Manage users, roles and permissions",
}

DEFAULT_ROLES = {
    "Chief": [PACKAGE_REGISTER, PACKAGE_UPDATE, PACKAGE_DELETE, RBAC_MANAGE],
    "Employee": [PACKAGE_REGISTER, PACKAGE_UPDATE, PACKAGE_DELETE],
    "Intern": [PACKAGE_REGISTER, PACKAGE_UPDATE],
}

# (username, full name, password, role) – local demo accounts only
DEMO_USERS = [
    ("chief", "Demo Chief", "chief123", "Chief"),
    ("employee", "Demo Employee", "employee123", "Employee"),
    ("intern", "Demo Intern", "intern123", "Intern"),
]


def seed(db: Session) -> None:
    """
    Fill an empty database with the default permissions, roles and demo users.

    Safe to run on every startup: missing permissions are always added, but
    roles and users are only created when their table is empty, so changes
    made through the admin page are never overwritten.
    """
    existing = {p.code: p for p in db.scalars(select(Permission))}
    for code, description in PERMISSIONS.items():
        if code not in existing:
            existing[code] = Permission(code=code, description=description)
            db.add(existing[code])

    if db.scalar(select(Role).limit(1)) is None:
        for name, codes in DEFAULT_ROLES.items():
            db.add(Role(name=name, permissions=[existing[c] for c in codes]))
    db.flush()

    if db.scalar(select(User).limit(1)) is None:
        roles = {r.name: r for r in db.scalars(select(Role))}
        for username, full_name, password, role_name in DEMO_USERS:
            # skip demo users whose role no longer exists
            if role_name in roles:
                db.add(
                    User(
                        username=username,
                        full_name=full_name,
                        password_hash=hash_password(password),
                        role=roles[role_name],
                    )
                )
    db.commit()
