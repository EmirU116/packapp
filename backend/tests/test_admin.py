import pytest


def _role_id(client, name: str) -> int:
    roles = client.get("/api/admin/roles").json()
    return next(r["id"] for r in roles if r["name"] == name)


def _user_id(client, username: str) -> int:
    users = client.get("/api/admin/users").json()
    return next(u["id"] for u in users if u["username"] == username)


@pytest.mark.parametrize("username", ["employee", "intern"])
def test_only_chief_can_manage_roles(login, username):
    client = login(username)
    assert client.get("/api/admin/roles").status_code == 403
    assert client.get("/api/admin/users").status_code == 403


def test_admin_requires_login(anonymous):
    assert anonymous.get("/api/admin/roles").status_code == 401


def test_chief_lists_roles_and_permissions(login):
    chief = login("chief")
    assert [r["name"] for r in chief.get("/api/admin/roles").json()] == [
        "Chief",
        "Employee",
        "Intern",
    ]
    assert len(chief.get("/api/admin/permissions").json()) == 4


def test_permission_change_applies_immediately(login):
    chief, intern = login("chief"), login("intern")
    assert "package.delete" not in intern.get("/api/auth/me").json()["permissions"]

    response = chief.put(
        f"/api/admin/roles/{_role_id(chief, 'Intern')}/permissions",
        json={"permissions": ["package.register", "package.update", "package.delete"]},
    )
    assert response.status_code == 200

    # the intern's existing session picks up the new permission without logging in again
    assert "package.delete" in intern.get("/api/auth/me").json()["permissions"]


def test_granting_rbac_manage_opens_admin(login):
    chief, employee = login("chief"), login("employee")
    chief.put(
        f"/api/admin/roles/{_role_id(chief, 'Employee')}/permissions",
        json={"permissions": ["package.register", "rbac.manage"]},
    )
    assert employee.get("/api/admin/roles").status_code == 200


def test_unknown_permission_is_rejected(login):
    chief = login("chief")
    response = chief.put(
        f"/api/admin/roles/{_role_id(chief, 'Intern')}/permissions",
        json={"permissions": ["package.fly"]},
    )
    assert response.status_code == 400


def test_cannot_remove_the_last_role_manager(login):
    chief = login("chief")
    chief_role = _role_id(chief, "Chief")

    # taking rbac.manage away from the only role that has it
    response = chief.put(
        f"/api/admin/roles/{chief_role}/permissions", json={"permissions": ["package.register"]}
    )
    assert response.status_code == 400
    assert "rbac.manage" in chief.get("/api/auth/me").json()["permissions"]

    # deactivating or demoting the only chief
    chief_user = _user_id(chief, "chief")
    assert chief.patch(f"/api/admin/users/{chief_user}", json={"is_active": False}).status_code == 400
    demote = chief.patch(
        f"/api/admin/users/{chief_user}", json={"role_id": _role_id(chief, "Intern")}
    )
    assert demote.status_code == 400
    assert chief.get("/api/admin/roles").status_code == 200


def test_create_role(login):
    chief = login("chief")
    response = chief.post(
        "/api/admin/roles", json={"name": "Night shift", "permissions": ["package.register"]}
    )
    assert response.status_code == 201
    assert response.json()["permissions"] == ["package.register"]
    duplicate = chief.post("/api/admin/roles", json={"name": "Night shift"})
    assert duplicate.status_code == 409


def test_create_user_who_can_log_in(login):
    chief = login("chief")
    response = chief.post(
        "/api/admin/users",
        json={
            "username": "anna",
            "full_name": "Anna Berg",
            "password": "anna-pass",
            "role_id": _role_id(chief, "Intern"),
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == "Intern"
    assert login("anna", "anna-pass").get("/api/auth/me").json()["full_name"] == "Anna Berg"


def test_duplicate_username_is_rejected(login):
    chief = login("chief")
    response = chief.post(
        "/api/admin/users",
        json={"username": "intern", "password": "whatever", "role_id": _role_id(chief, "Intern")},
    )
    assert response.status_code == 409


def test_change_user_role(login):
    chief = login("chief")
    response = chief.patch(
        f"/api/admin/users/{_user_id(chief, 'intern')}",
        json={"role_id": _role_id(chief, "Employee")},
    )
    assert response.status_code == 200
    assert "package.delete" in login("intern").get("/api/auth/me").json()["permissions"]


def test_deactivated_user_is_locked_out(login, anonymous):
    chief, employee = login("chief"), login("employee")
    response = chief.patch(
        f"/api/admin/users/{_user_id(chief, 'employee')}", json={"is_active": False}
    )
    assert response.status_code == 200

    # the existing session stops working and a new login is refused
    assert employee.get("/api/auth/me").status_code == 401
    retry = anonymous.post(
        "/api/auth/login", json={"username": "employee", "password": "employee123"}
    )
    assert retry.status_code == 401
