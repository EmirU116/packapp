import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

SESSION_COOKIE = "packapp_session"
_JWT_ALGORITHM = "HS256"
# scrypt cost parameters (CPU/memory, block size, parallelism)
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    """
    Hash a password with scrypt and a random salt.

    Returns "salt_hex$hash_hex" so the salt is stored next to the hash.
    """
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Check a password against a value produced by `hash_password`."""
    try:
        salt_hex, digest_hex = stored.split("$")
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return hmac.compare_digest(digest, expected)


def authenticate(db: Session, username: str, password: str) -> User | None:
    """Return the active user matching the credentials, or None."""
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        return None
    return user if verify_password(password, user.password_hash) else None


def create_access_token(user: User) -> str:
    """Create the signed token that is stored in the session cookie."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.token_expire_minutes)
    return jwt.encode({"sub": str(user.id), "exp": expires}, settings.secret_key, _JWT_ALGORITHM)


def get_current_user(
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that resolves the logged-in user from the session cookie.

    The user is loaded from the database on every request, so a deactivated
    user or a changed role takes effect immediately. Raises 401 when the
    cookie is missing, invalid or expired, or the user is no longer active.
    """
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    if token is None:
        raise unauthorized
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user
