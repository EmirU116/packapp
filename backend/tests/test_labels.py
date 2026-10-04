from io import BytesIO

import pytest
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth

from app.config import settings
from app.services.labels import BOLD, FONT, clean_text, fit_text, wrap_text
from tests.test_packages import register


def fetch_pdf(client, ids, output=None) -> PdfReader:
    params = {"ids": ids, **({"output": output} if output else {})}
    response = client.get("/api/labels", params=params)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    return PdfReader(BytesIO(response.content))


def page_text(reader: PdfReader, page: int = 0) -> str:
    return reader.pages[page].extract_text()


# --- text fitting: the reason fields cannot overlap -----------------------


def test_fit_text_keeps_short_text_at_full_size():
    assert fit_text("Anna Berg", BOLD, 19, 7, 200) == ("Anna Berg", 19)


def test_fit_text_shrinks_before_cutting():
    text, size = fit_text("Anna Berg", BOLD, 19, 7, 60)
    assert text == "Anna Berg"
    assert 7 <= size < 19
    assert stringWidth(text, BOLD, size) <= 60


def test_fit_text_cuts_text_that_cannot_fit():
    text, size = fit_text("W" * 100, BOLD, 19, 7, 100)
    assert size == 7
    assert text.endswith("…")
    assert stringWidth(text, BOLD, size) <= 100


@pytest.mark.parametrize(
    "text",
    ["short", "several words that need more than one line to fit", "W" * 120, "word " * 60],
)
def test_wrap_text_never_exceeds_lines_or_width(text):
    lines = wrap_text(text, FONT, 9, 150, max_lines=3)
    assert 1 <= len(lines) <= 3
    assert all(stringWidth(line, FONT, 9) <= 150 for line in lines)


def test_wrap_text_keeps_everything_when_it_fits():
    assert wrap_text("Leave at the lab door", FONT, 9, 60, max_lines=3) == [
        "Leave at the",
        "lab door",
    ]


def test_clean_text_handles_swedish_and_unsupported_characters():
    assert clean_text("  Åsa   Öberg ") == "Åsa Öberg"
    # characters outside the built-in fonts are replaced instead of crashing
    assert clean_text("包裹") == "??"
    assert clean_text(None) == ""


# --- single label ---------------------------------------------------------


def test_single_label_is_one_page_with_the_label_fields(login):
    client = login("intern")
    package = register(client)
    reader = fetch_pdf(client, [package["id"]])

    assert len(reader.pages) == 1
    text = page_text(reader)
    # tracking number, from, to, type, extra information, room number
    for expected in (
        "1Z999AA10123456784",
        "Sigma Aldrich",
        "Anna Berg",
        "Parcel",
        "Leave at the lab door",
        "C412",
    ):
        assert expected in text


def test_label_page_has_the_configured_sticker_size(login, monkeypatch):
    client = login("intern")
    package = register(client)

    box = fetch_pdf(client, [package["id"]]).pages[0].mediabox
    assert (float(box.width), float(box.height)) == pytest.approx((100 * mm, 150 * mm))

    monkeypatch.setattr(settings, "label_width_mm", 62)
    monkeypatch.setattr(settings, "label_height_mm", 100)
    box = fetch_pdf(client, [package["id"]]).pages[0].mediabox
    assert (float(box.width), float(box.height)) == pytest.approx((62 * mm, 100 * mm))


def test_label_uses_institute_when_there_is_no_recipient(login):
    client = login("intern")
    package = register(client, recipient="", institute="Physics")
    assert "Physics" in page_text(fetch_pdf(client, [package["id"]]))


def test_label_with_longest_possible_values_still_renders(login):
    client = login("employee")
    package = register(
        client,
        tracking_number="X" * 64,
        sender="W" * 100,
        recipient="W" * 100,
        institute="W" * 100,
        room_number="W" * 50,
        extra_information="W" * 120,
    )
    reader = fetch_pdf(client, [package["id"]])
    assert len(reader.pages) == 1
    # over-long values are cut rather than allowed to spill
    assert "…" in page_text(reader)


def test_label_with_minimal_package(login):
    client = login("employee")
    response = client.post("/api/packages", json={"package_type": "EXT", "institute": "Library"})
    reader = fetch_pdf(client, [response.json()["id"]])
    assert "Library" in page_text(reader)


# --- multi register outputs -----------------------------------------------


@pytest.fixture()
def batch(login):
    """A client and three packages registered together, two sharing a number."""
    client = login("employee")
    body = {
        "package_type": "Cold",
        "sender": "Fisher Scientific",
        "recipient": "Bo Ek",
        "institute": "Biology",
        "room_number": "B7",
        "tracking_numbers": ["SHIP-1", "SHIP-1", "SHIP-2"],
    }
    response = client.post("/api/packages/bulk", json=body)
    assert response.status_code == 201
    return client, [p["id"] for p in response.json()]


def test_multiple_labels_gives_one_page_per_package(batch):
    client, ids = batch
    reader = fetch_pdf(client, ids, "labels")
    assert len(reader.pages) == 3
    assert "SHIP-1" in page_text(reader, 0)
    assert "SHIP-2" in page_text(reader, 2)


def test_labels_follow_the_requested_order(batch):
    client, ids = batch
    reader = fetch_pdf(client, list(reversed(ids)), "labels")
    assert "SHIP-2" in page_text(reader, 0)


def test_summary_label_is_one_page_showing_the_count(batch):
    client, ids = batch
    reader = fetch_pdf(client, ids, "summary")
    assert len(reader.pages) == 1
    text = page_text(reader)
    assert "PACKAGES" in text
    assert "3" in text.split("PACKAGES")[1]
    assert "Bo Ek" in text and "SHIP-1" in text


def test_paper_list_is_a4_and_lists_every_package(batch):
    client, ids = batch
    reader = fetch_pdf(client, ids, "list")
    box = reader.pages[0].mediabox
    # A4 landscape
    assert (float(box.width), float(box.height)) == pytest.approx((297 * mm, 210 * mm), abs=0.01)
    text = page_text(reader)
    assert "3 package(s)" in text
    assert text.count("SHIP-1") == 2 and text.count("SHIP-2") == 1
    assert "Bo Ek (Biology)" in text


def test_long_paper_list_continues_on_more_pages(login):
    client = login("employee")
    body = {"package_type": "Parcel", "institute": "Physics", "tracking_numbers": [""] * 60}
    ids = [p["id"] for p in client.post("/api/packages/bulk", json=body).json()]
    reader = fetch_pdf(client, ids, "list")
    assert len(reader.pages) > 1
    # the header row is repeated on the following pages
    assert "Tracking number" in page_text(reader, 1)


# --- errors and access ----------------------------------------------------


def test_unknown_package_gives_404(batch):
    client, ids = batch
    assert client.get("/api/labels", params={"ids": [ids[0], 9999]}).status_code == 404


def test_ids_are_required(login):
    assert login("intern").get("/api/labels").status_code == 422


def test_unknown_output_is_rejected(batch):
    client, ids = batch
    assert client.get("/api/labels", params={"ids": ids, "output": "poster"}).status_code == 422


def test_labels_require_login(anonymous):
    assert anonymous.get("/api/labels", params={"ids": [1]}).status_code == 401
