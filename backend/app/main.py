from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import BASE_DIR
from app.database import Base, SessionLocal, engine
from app.routers import admin, auth, labels, notifications, packages, tracking
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """On startup: make sure the local database, its tables and seed data exist."""
    (BASE_DIR / "data").mkdir(exist_ok=True)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="PackApp", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(packages.router)
app.include_router(tracking.router)
app.include_router(labels.router)
app.include_router(notifications.router)
