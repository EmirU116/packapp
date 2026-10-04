"""
PDF output for packages: sticker labels and the paper list.

The label is a stack of fixed boxes. Every piece of text is fitted to its own
box (shrunk, wrapped or cut with "…"), which is what guarantees that fields
never run into each other, whatever the user typed.
"""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings
from app.models import Package

FONT = "Helvetica"
BOLD = "Helvetica-Bold"

_MARGIN = 4 * mm
_PADDING = 2 * mm
# The label was designed at this inner size; other sizes scale the fonts from it
_DESIGN_WIDTH, _DESIGN_HEIGHT = 92 * mm, 142 * mm
# Share of the label height for each row, top to bottom (sums to 1)
_ROWS = {"code": 0.25, "from": 0.13, "to": 0.22, "room_type": 0.14, "extra": 0.20, "footer": 0.06}
# Thinner bars than this are unreliable to scan, so a QR code is used instead
_MIN_BAR_WIDTH = 0.2 * mm
_MAX_BAR_WIDTH = 0.5 * mm


# --- text fitting ---------------------------------------------------------


def clean_text(value: object) -> str:
    """Collapse whitespace and replace characters the built-in PDF fonts cannot draw."""
    text = " ".join(str(value or "").split())
    return text.encode("cp1252", "replace").decode("cp1252")


def fit_text(text: str, font: str, max_size: float, min_size: float, max_width: float):
    """
    Make one line of text fit in `max_width`.

    The font size is reduced from `max_size` down to `min_size`; if the text
    is still too wide it is cut and ended with "…".
    Returns (text to draw, font size).
    """
    size = max_size
    while size > min_size and stringWidth(text, font, size) > max_width:
        size = max(size - 0.5, min_size)
    if stringWidth(text, font, size) > max_width:
        # drop characters until the text plus the ellipsis fits
        while text and stringWidth(text + "…", font, size) > max_width:
            text = text[:-1]
        text = text.rstrip() + "…"
    return text, size


def wrap_text(text: str, font: str, size: float, max_width: float, max_lines: int) -> list[str]:
    """
    Break text into at most `max_lines` lines no wider than `max_width`.

    Words too long for a line are split. Text that does not fit in the
    allowed lines is cut, and the last line ends with "…".
    """
    lines: list[str] = []
    current = ""
    for word in text.split():
        # split a word that cannot fit on a line by itself
        while stringWidth(word, font, size) > max_width:
            cut = len(word)
            while cut > 1 and stringWidth(word[:cut], font, size) > max_width:
                cut -= 1
            if current:
                lines.append(current)
                current = ""
            lines.append(word[:cut])
            word = word[cut:]
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)

    if len(lines) > max_lines:
        # squeeze the overflow into the last line and let fit_text cut it
        lines = lines[: max_lines - 1] + [" ".join(lines[max_lines - 1 :])]
    return [fit_text(line, font, size, size, max_width)[0] for line in lines]


# --- drawing helpers ------------------------------------------------------


def _draw_code(c: Canvas, value: str, x: float, y: float, width: float, height: float) -> None:
    """
    Draw the scannable tracking number inside the given area.

    A Code128 barcode is used when the number is plain ASCII and its bars
    would be wide enough to scan; otherwise (very long or unusual numbers)
    a QR code is drawn, which every modern scanner also reads.
    """
    if value.isascii() and value.isprintable():
        # width at 1pt per bar tells how many bars the number needs
        bars = code128.Code128(value, barWidth=1, quiet=False).width
        # keep empty space on both sides; scanners need it
        bar_width = min((width - 10 * mm) / bars, _MAX_BAR_WIDTH)
        if bar_width >= _MIN_BAR_WIDTH:
            barcode = code128.Code128(value, barWidth=bar_width, barHeight=height, quiet=False)
            barcode.drawOn(c, x + (width - barcode.width) / 2, y)
            return

    widget = qr.QrCodeWidget(value, barLevel="M")
    left, bottom, right, top = widget.getBounds()
    side = min(width, height)
    drawing = Drawing(side, side, transform=[side / (right - left), 0, 0, side / (top - bottom), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x + (width - side) / 2, y)


def _draw_box(c: Canvas, caption: str, x: float, y: float, width: float, height: float, scale: float):
    """Draw a bordered box with a small caption in the top-left corner."""
    c.setLineWidth(0.6)
    c.rect(x, y, width, height)
    c.setFont(FONT, 6 * scale)
    c.setFillGray(0.35)
    c.drawString(x + _PADDING, y + height - 2.6 * mm * scale, caption.upper())
    c.setFillGray(0)


def _draw_value(c: Canvas, text: str, x: float, y: float, width: float, size: float, scale: float, font=BOLD):
    """Draw one fitted line of text starting at (x + padding, y)."""
    text, size = fit_text(clean_text(text) or "–", font, size * scale, 7 * scale, width - 2 * _PADDING)
    c.setFont(font, size)
    c.drawString(x + _PADDING, y, text)


def _draw_label(c: Canvas, package: Package, count: int | None = None) -> None:
    """
    Draw one label on the current page.

    Rows from the top: scannable tracking number, From, To, Room | Type,
    Extra information, footer. When `count` is given (summary label), the
    extra row is shared with a box showing the number of packages.
    """
    page_width, page_height = c._pagesize
    x = _MARGIN
    width = page_width - 2 * _MARGIN
    usable = page_height - 2 * _MARGIN
    scale = min(width / _DESIGN_WIDTH, usable / _DESIGN_HEIGHT)
    heights = {name: share * usable for name, share in _ROWS.items()}
    top = page_height - _MARGIN

    # scannable code with the number in clear text below it
    y = top - heights["code"]
    text_height = 5 * mm * scale
    _draw_code(c, package.tracking_number, x, y + text_height, width, heights["code"] - text_height - 1 * mm)
    number, size = fit_text(clean_text(package.tracking_number), BOLD, 11 * scale, 6 * scale, width)
    c.setFont(BOLD, size)
    c.drawCentredString(x + width / 2, y + 1.2 * mm, number)

    # from
    h = heights["from"]
    y -= h
    _draw_box(c, "From", x, y, width, h, scale)
    _draw_value(c, package.sender, x, y + h * 0.25, width, 13, scale)

    # to: recipient (or institute when there is no name), then institute and route
    h = heights["to"]
    y -= h
    _draw_box(c, "To", x, y, width, h, scale)
    _draw_value(c, package.delivery_target, x, y + h * 0.52, width, 19, scale)
    details = [package.institute if package.recipient else "", f"Route {package.route}" if package.route else ""]
    details = [d for d in details if d]
    if details:
        _draw_value(c, "  ·  ".join(details), x, y + h * 0.16, width, 10, scale, font=FONT)

    # room | type
    h = heights["room_type"]
    y -= h
    room_width = width * 0.4
    _draw_box(c, "Room", x, y, room_width, h, scale)
    _draw_value(c, package.room_number, x, y + h * 0.22, room_width, 17, scale)
    _draw_box(c, "Type", x + room_width, y, width - room_width, h, scale)
    _draw_value(c, package.package_type, x + room_width, y + h * 0.22, width - room_width, 15, scale)

    # extra information (and the package count on a summary label)
    h = heights["extra"]
    y -= h
    extra_width = width if count is None else width * 0.64
    _draw_box(c, "Extra information", x, y, extra_width, h, scale)
    size = 9 * scale
    leading = size * 1.25
    # as many lines as fit under the caption
    max_lines = max(1, int((h - 5 * mm * scale) / leading))
    lines = wrap_text(clean_text(package.extra_information), FONT, size, extra_width - 2 * _PADDING, max_lines)
    c.setFont(FONT, size)
    for index, line in enumerate(lines):
        c.drawString(x + _PADDING, y + h - 4 * mm * scale - (index + 1) * leading, line)
    if count is not None:
        count_x, count_width = x + extra_width, width - extra_width
        _draw_box(c, "Packages", count_x, y, count_width, h, scale)
        text, size = fit_text(str(count), BOLD, 30 * scale, 10 * scale, count_width - 2 * _PADDING)
        c.setFont(BOLD, size)
        c.drawCentredString(count_x + count_width / 2, y + h * 0.25, text)

    # footer
    y -= heights["footer"]
    c.setFont(FONT, 7 * scale)
    c.drawString(x, y + 1.5 * mm, f"Registered {package.created_at:%Y-%m-%d %H:%M}")
    c.drawRightString(x + width, y + 1.5 * mm, f"PackApp #{package.id}")


def _label_canvas(buffer: BytesIO, title: str) -> Canvas:
    size = (settings.label_width_mm * mm, settings.label_height_mm * mm)
    canvas = Canvas(buffer, pagesize=size)
    canvas.setTitle(title)
    return canvas


# --- public API -----------------------------------------------------------


def render_labels(packages: list[Package]) -> bytes:
    """A PDF with one sticker label per package, one label per page."""
    buffer = BytesIO()
    canvas = _label_canvas(buffer, "Package labels")
    for package in packages:
        _draw_label(canvas, package)
        canvas.showPage()
    canvas.save()
    return buffer.getvalue()


def render_summary_label(packages: list[Package]) -> bytes:
    """
    A PDF with a single label for a group of packages, showing how many
    there are. The details are taken from the first package.
    """
    buffer = BytesIO()
    canvas = _label_canvas(buffer, "Package summary label")
    _draw_label(canvas, packages[0], count=len(packages))
    canvas.showPage()
    canvas.save()
    return buffer.getvalue()


def render_package_list(packages: list[Package]) -> bytes:
    """
    An A4 (landscape) paper list of the packages, with a signature column
    so it can be used as a delivery sheet. Long lists continue on new pages
    with the header row repeated.
    """
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        title="Package list",
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    cell = ParagraphStyle("cell", fontName=FONT, fontSize=8.5, leading=10.5)
    heading = ParagraphStyle("heading", fontName=BOLD, fontSize=15, leading=19)

    def paragraph(value: object) -> Paragraph:
        return Paragraph(escape(clean_text(value)), cell)

    rows = [["#", "Tracking number", "From", "To", "Room", "Route", "Type", "Signature"]]
    for index, package in enumerate(packages, start=1):
        # show the institute under the name when both are known
        target = package.delivery_target
        if package.recipient and package.institute:
            target = f"{target} ({package.institute})"
        rows.append(
            [
                str(index),
                paragraph(package.tracking_number),
                paragraph(package.sender),
                paragraph(target),
                paragraph(package.room_number),
                paragraph(package.route),
                paragraph(package.package_type),
                "",
            ]
        )

    table = Table(
        rows,
        colWidths=[w * mm for w in (10, 50, 45, 55, 22, 22, 30, 39)],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    summary = f"{len(packages)} package(s) – printed {datetime.now():%Y-%m-%d %H:%M}"
    document.build([Paragraph("Package list", heading), Paragraph(summary, cell), Spacer(1, 5 * mm), table])
    return buffer.getvalue()
