import pytest

from app.services.auth import hash_password, verify_password


def test_password_hash_roundtrip():
    stored = hash_password("secret-1")
    assert stored != "secret-1"
    assert verify_password("secret-1", stored)
    assert not verify_password("secret-2", stored)
    assert not verify_password("secret-1", "not-a-valid-hash")


def test_login_returns_user_and_starts_session(login):
    client = login("chief")
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "chief"
    assert me.json()["role"] == "Chief"


def test_login_with_wrong_password_is_rejected(anonymous):
    response = anonymous.post("/api/auth/login", json={"username": "chief", "password": "nope"})
    assert response.status_code == 401
    assert anonymous.get("/api/auth/me").status_code == 401


def test_login_with_unknown_user_is_rejected(anonymous):
    response = anonymous.post("/api/auth/login", json={"username": "ghost", "password": "x"})
    assert response.status_code == 401


def test_me_requires_login(anonymous):
    assert anonymous.get("/api/auth/me").status_code == 401


def test_tampered_cookie_is_rejected(anonymous):
    anonymous.cookies.set("packapp_session", "not.a.token")
    assert anonymous.get("/api/auth/me").status_code == 401


def test_logout_ends_session(login):
    client = login("employee")
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize(
    ("username", "expected"),
    [
        ("chief", {"package.register", "package.update", "package.delete", "rbac.manage"}),
        ("employee", {"package.register", "package.update", "package.delete"}),
        ("intern", {"package.register", "package.update"}),
    ],
)
def test_seeded_roles_match_the_brief(login, username, expected):
    assert set(login(username).get("/api/auth/me").json()["permissions"]) == expected
