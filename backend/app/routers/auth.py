from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, UserOut
from app.services.auth import (
    SESSION_COOKIE,
    authenticate,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)) -> UserOut:
    """Check the credentials and start a session by setting the login cookie."""
    user = authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    # HttpOnly keeps the token out of reach of page scripts
    response.set_cookie(
        SESSION_COOKIE,
        create_access_token(user),
        max_age=settings.token_expire_minutes * 60,
        httponly=True,
        samesite="lax",
    )
    return UserOut.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    """The logged-in user with role and permissions; the frontend uses this to show or hide actions."""
    return UserOut.from_user(user)
