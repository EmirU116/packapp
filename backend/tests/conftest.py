import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import DEMO_USERS, seed

PASSWORDS = {username: password for username, _, password, _ in DEMO_USERS}


@pytest.fixture()
def test_app():
    """The app wired to a fresh, seeded in-memory database for each test."""
    # StaticPool: every session shares the single in-memory connection
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        seed(db)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture()
def anonymous(test_app) -> TestClient:
    """A client that is not logged in."""
    return TestClient(test_app)


@pytest.fixture()
def login(test_app):
    """Factory: `login("chief")` returns a client logged in as that demo user."""

    def _login(username: str, password: str | None = None) -> TestClient:
        client = TestClient(test_app)
        response = client.post(
            "/api/auth/login",
            json={"username": username, "password": password or PASSWORDS[username]},
        )
        assert response.status_code == 200, response.text
        return client

    return _login
