import re
from datetime import date, timedelta

import pytest

PACKAGE = {
    "tracking_number": "1Z999AA10123456784",
    "carrier": "UPS",
    "package_type": "Parcel",
    "sender": "Sigma Aldrich",
    "recipient": "Anna Berg",
    "institute": "Chemistry",
    "route": "ABC",
    "su_number": "SU-1001",
    "email": "anna.berg@example.com",
    "room_number": "C412",
    "extra_information": "Leave at the lab door",
}


def register(client, **overrides):
    """Register a package from the PACKAGE template with some fields changed."""
    response = client.post("/api/packages", json={**PACKAGE, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


# --- register -------------------------------------------------------------


def test_register_saves_all_fields(login):
    package = register(login("intern"))
    for field, value in PACKAGE.items():
        assert package[field] == value
    assert package["status"] == "registered"
    assert package["created_by"] == "intern"
    assert package["created_at"] and package["updated_at"]


def test_register_requires_login(anonymous):
    assert anonymous.post("/api/packages", json=PACKAGE).status_code == 401


def test_missing_tracking_number_is_generated(login):
    client = login("employee")
    first = register(client, tracking_number="")
    second = register(client, tracking_number="")
    assert re.fullmatch(r"PA-\d{8}-[2-9A-Z]{4}", first["tracking_number"])
    assert first["tracking_number"] != second["tracking_number"]


def test_institute_is_enough_when_recipient_is_unknown(login):
    package = register(login("employee"), recipient="", institute="Chemistry")
    assert package["recipient"] == ""
    assert package["institute"] == "Chemistry"


def test_recipient_or_institute_is_required(login):
    response = login("employee").post(
        "/api/packages", json={**PACKAGE, "recipient": "", "institute": ""}
    )
    assert response.status_code == 422


def test_extra_information_has_a_length_limit(login):
    client = login("employee")
    assert register(client, extra_information="x" * 120)["extra_information"] == "x" * 120
    too_long = client.post("/api/packages", json={**PACKAGE, "extra_information": "x" * 121})
    assert too_long.status_code == 422


@pytest.mark.parametrize(
    "bad",
    [{"package_type": "Balloon"}, {"route": "XYZ"}, {"email": "not-an-email"}],
)
def test_invalid_values_are_rejected(login, bad):
    assert login("employee").post("/api/packages", json={**PACKAGE, **bad}).status_code == 422


def test_route_can_be_left_empty(login):
    assert register(login("employee"), route="")["route"] is None


def test_options_list_the_choices_from_the_brief(login):
    options = login("intern").get("/api/packages/options").json()
    assert options["package_types"] == [
        "Cold",
        "Parcel",
        "Frozen",
        "Multiple temperatures",
        "REK letter",
        "Pallet",
        "EXT",
    ]
    assert options["routes"] == ["ABC", "DEF", "MBW", "Arrenhius", "Biblotek"]
    assert options["extra_information_max"] == 120


# --- email notification ---------------------------------------------------


def test_notification_only_when_checked(login):
    client = login("employee")
    register(client)
    assert client.get("/api/notifications").json() == []

    package = register(client, notify=True)
    (notification,) = client.get("/api/notifications").json()
    assert notification["to_email"] == "anna.berg@example.com"
    assert notification["package_id"] == package["id"]
    assert package["tracking_number"] in notification["body"]


def test_notification_needs_an_email_address(login):
    response = login("employee").post(
        "/api/packages", json={**PACKAGE, "email": "", "notify": True}
    )
    assert response.status_code == 422


# --- multi register -------------------------------------------------------


def test_bulk_register_creates_one_package_per_number(login):
    client = login("employee")
    body = {**PACKAGE, "tracking_numbers": ["AAA1", "AAA1", "", "BBB2"], "notify": True}
    del body["tracking_number"]
    response = client.post("/api/packages/bulk", json=body)
    assert response.status_code == 201
    packages = response.json()

    numbers = [p["tracking_number"] for p in packages]
    # the same number may be shared by several packages; the empty one is generated
    assert numbers[:2] == ["AAA1", "AAA1"] and numbers[3] == "BBB2"
    assert numbers[2].startswith("PA-")
    assert {p["recipient"] for p in packages} == {"Anna Berg"}

    # one notification for the whole batch, not one per package
    (notification,) = client.get("/api/notifications").json()
    assert "4 packages" in notification["body"]


def test_bulk_register_needs_at_least_one_package(login):
    body = {**PACKAGE, "tracking_numbers": []}
    assert login("employee").post("/api/packages/bulk", json=body).status_code == 422


# --- update ---------------------------------------------------------------


def test_update_changes_only_sent_fields(login):
    client = login("intern")
    package = register(client)
    response = client.patch(
        f"/api/packages/{package['id']}", json={"room_number": "D101", "status": "delivered"}
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["room_number"] == "D101"
    assert updated["status"] == "delivered"
    assert updated["recipient"] == "Anna Berg"


def test_update_can_clear_route(login):
    client = login("employee")
    package = register(client)
    assert client.patch(f"/api/packages/{package['id']}", json={"route": ""}).json()["route"] is None


def test_update_cannot_remove_the_delivery_target(login):
    client = login("employee")
    package = register(client)
    response = client.patch(
        f"/api/packages/{package['id']}", json={"recipient": "", "institute": ""}
    )
    assert response.status_code == 422
    assert client.get(f"/api/packages/{package['id']}").json()["recipient"] == "Anna Berg"


def test_update_unknown_package(login):
    assert login("employee").patch("/api/packages/999", json={"carrier": "DHL"}).status_code == 404


# --- delete and permissions -----------------------------------------------


def test_employee_can_delete(login):
    client = login("employee")
    package = register(client, notify=True)
    assert client.delete(f"/api/packages/{package['id']}").status_code == 204
    assert client.get(f"/api/packages/{package['id']}").status_code == 404
    assert client.get("/api/notifications").json() == []


def test_intern_cannot_delete(login):
    intern = login("intern")
    package = register(intern)
    assert intern.delete(f"/api/packages/{package['id']}").status_code == 403
    assert intern.get(f"/api/packages/{package['id']}").status_code == 200


def test_revoked_permission_blocks_register_and_update(login):
    chief, intern = login("chief"), login("intern")
    package = register(intern)
    intern_role = next(r for r in chief.get("/api/admin/roles").json() if r["name"] == "Intern")
    chief.put(f"/api/admin/roles/{intern_role['id']}/permissions", json={"permissions": []})

    assert intern.post("/api/packages", json=PACKAGE).status_code == 403
    assert intern.patch(f"/api/packages/{package['id']}", json={"carrier": "DHL"}).status_code == 403
    # searching stays available to every logged-in user
    assert intern.get("/api/packages").status_code == 200


# --- search ---------------------------------------------------------------


@pytest.fixture()
def stocked(login):
    """A client with three different packages registered."""
    client = login("employee")
    register(client, tracking_number="TRACK-001", recipient="Anna Berg", sender="Sigma Aldrich")
    register(client, tracking_number="TRACK-002", recipient="Bo Ek", sender="Fisher Scientific")
    register(
        client,
        tracking_number="OTHER-003",
        recipient="",
        institute="Physics",
        sender="Sigma Aldrich",
        carrier="Fisher Transport",
    )
    return client


def search(client, **params):
    response = client.get("/api/packages", params=params)
    assert response.status_code == 200
    return response.json()


def test_search_without_filters_returns_newest_first(stocked):
    result = search(stocked)
    assert result["total"] == 3
    assert [p["tracking_number"] for p in result["items"]] == ["OTHER-003", "TRACK-002", "TRACK-001"]


def test_search_by_recipient_name(stocked):
    assert [p["recipient"] for p in search(stocked, q="anna")["items"]] == ["Anna Berg"]


def test_search_by_institute_when_there_is_no_recipient(stocked):
    assert [p["tracking_number"] for p in search(stocked, q="physics")["items"]] == ["OTHER-003"]


def test_search_by_company_matches_sender_not_carrier(stocked):
    # "fisher" is the sender of TRACK-002 and only the carrier of OTHER-003
    assert [p["tracking_number"] for p in search(stocked, q="fisher")["items"]] == ["TRACK-002"]
    assert search(stocked, q="sigma")["total"] == 2


def test_search_by_tracking_number(stocked):
    assert search(stocked, q="track-")["total"] == 2
    assert search(stocked, q="OTHER-003")["total"] == 1


def test_search_treats_wildcards_literally(stocked):
    assert search(stocked, q="%")["total"] == 0


def test_search_by_date(stocked):
    today = date.today()
    tomorrow, yesterday = today + timedelta(days=1), today - timedelta(days=1)
    assert search(stocked, date_from=today.isoformat(), date_to=today.isoformat())["total"] == 3
    assert search(stocked, date_from=tomorrow.isoformat())["total"] == 0
    assert search(stocked, date_to=yesterday.isoformat())["total"] == 0
    assert search(stocked, q="anna", date_from=yesterday.isoformat())["total"] == 1


def test_search_is_paginated(stocked):
    page = search(stocked, limit=2, offset=2)
    assert page["total"] == 3
    assert [p["tracking_number"] for p in page["items"]] == ["TRACK-001"]


# --- suggestions ----------------------------------------------------------


def test_recipient_suggestion_remembers_latest_details(stocked):
    register(stocked, recipient="Anna Berg", room_number="NEW-9")
    (suggestion,) = stocked.get("/api/packages/suggest/recipients", params={"q": "ann"}).json()
    assert suggestion["recipient"] == "Anna Berg"
    assert suggestion["room_number"] == "NEW-9"
    assert suggestion["institute"] == "Chemistry"


def test_sender_suggestions_are_distinct(stocked):
    senders = stocked.get("/api/packages/suggest/senders", params={"q": "s"}).json()
    assert senders == ["Fisher Scientific", "Sigma Aldrich"]
