from pydantic import BaseModel

from app.models import User


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    """A user as the frontend sees it, including what the user may do."""

    id: int
    username: str
    full_name: str
    is_active: bool
    role_id: int
    role: str
    permissions: list[str]

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            role_id=user.role_id,
            role=user.role.name,
            permissions=[p.code for p in user.role.permissions],
        )
