import httpx
import pytest

from app.config import settings
from app.services.tracking import parcelsapp
from app.services.tracking.local import detect_carrier
from tests.test_packages import register


@pytest.mark.parametrize(
    ("number", "carrier"),
    [
        ("1Z999AA10123456784", "UPS"),
        ("1z999aa10123456784", "UPS"),
        ("RR123456789SE", "PostNord"),
        ("JJD0099999999999", "DHL"),
        ("1234567890", "DHL"),
        ("123456789012", "FedEx"),
        ("UNKNOWN-FORMAT", None),
    ],
)
def test_detect_carrier(number, carrier):
    assert detect_carrier(number) == carrier


def test_lookup_fills_carrier_from_number_shape(login):
    response = login("intern").get("/api/tracking/lookup/1Z999AA10123456784")
    assert response.status_code == 200
    assert response.json() == {
        "tracking_number": "1Z999AA10123456784",
        "fields": {"carrier": "UPS"},
        "sources": ["pattern"],
    }


def test_lookup_of_unknown_number_finds_nothing(login):
    body = login("intern").get("/api/tracking/lookup/UNKNOWN-FORMAT").json()
    assert body["fields"] == {} and body["sources"] == []


def test_lookup_reuses_details_of_an_earlier_package(login):
    client = login("employee")
    register(client, tracking_number="1Z999AA10123456784", carrier="UPS Express")
    body = client.get("/api/tracking/lookup/1z999aa10123456784").json()
    assert body["sources"] == ["pattern", "history"]
    # what was registered before wins over the guess from the number's shape
    assert body["fields"]["carrier"] == "UPS Express"
    assert body["fields"]["recipient"] == "Anna Berg"
    assert body["fields"]["room_number"] == "C412"
    # one-off notes are not carried over
    assert "extra_information" not in body["fields"]


def test_lookup_needs_register_permission(anonymous):
    assert anonymous.get("/api/tracking/lookup/123").status_code == 401


def test_generate_tracking_number(login):
    body = login("intern").get("/api/tracking/generate").json()
    assert body["tracking_number"].startswith("PA-")


# --- Parcelsapp provider (HTTP is faked; no real requests are made) -------


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_parcelsapp_reads_carrier_from_cached_answer():
    def handler(request):
        return httpx.Response(
            200, json={"done": True, "shipments": [{"detectedCarrier": {"name": "PostNord"}}]}
        )

    assert parcelsapp.lookup_parcelsapp("X1", _client(handler)) == {"carrier": "PostNord"}


def test_parcelsapp_polls_until_done(monkeypatch):
    monkeypatch.setattr(parcelsapp, "_POLL_DELAY_SECONDS", 0)
    calls = []

    def handler(request):
        calls.append(request.method)
        if request.method == "POST":
            return httpx.Response(200, json={"uuid": "abc"})
        assert request.url.params["uuid"] == "abc"
        return httpx.Response(
            200, json={"done": True, "shipments": [{"detectedCarrier": {"name": "DHL"}}]}
        )

    assert parcelsapp.lookup_parcelsapp("X1", _client(handler)) == {"carrier": "DHL"}
    assert calls == ["POST", "GET"]


def test_parcelsapp_failure_falls_back_to_nothing():
    assert parcelsapp.lookup_parcelsapp("X1", _client(lambda r: httpx.Response(500))) == {}
    assert parcelsapp.lookup_parcelsapp("X1", _client(lambda r: httpx.Response(200, json={}))) == {}


def test_lookup_uses_parcelsapp_only_when_key_is_set(login, monkeypatch):
    monkeypatch.setattr(
        "app.services.tracking.lookup_parcelsapp", lambda number: {"carrier": "Bring"}
    )
    client = login("intern")
    assert client.get("/api/tracking/lookup/UNKNOWN-FORMAT").json()["sources"] == []

    monkeypatch.setattr(settings, "parcelsapp_api_key", "test-key")
    body = client.get("/api/tracking/lookup/UNKNOWN-FORMAT").json()
    assert body == {
        "tracking_number": "UNKNOWN-FORMAT",
        "fields": {"carrier": "Bring"},
        "sources": ["parcelsapp"],
    }
