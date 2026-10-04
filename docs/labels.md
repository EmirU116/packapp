# Labels and the paper list (PDF)

One endpoint produces every printable PDF:

```
GET /api/labels?ids=4&ids=5&ids=6&output=labels
```

- `ids` – the packages to print, repeated once per package. They are printed in the order given.
- `output` – what to print (see below). Default `labels`.

Any logged-in user can print. The PDF opens in the browser's PDF viewer, from where it is printed.

| `output` | Result | Used by |
|---|---|---|
| `labels` | One sticker label per package, one per page | Single register (one id → exactly one label), multi register "multiple labels" |
| `summary` | One label for the whole group, with a box showing how many packages there are. Details come from the first package. | Multi register "one label with the package count" |
| `list` | An A4 landscape list of all the packages with a signature column | Multi register "paper list" |

## What is on a label

From top to bottom:

1. **Scannable tracking number**, with the number in clear text underneath
2. **From** – the sender
3. **To** – the recipient, or the institute when there is no recipient name; below it the institute and route
4. **Room** and **Type**
5. **Extra information** (on a summary label this row also holds the **Packages** count)
6. A footer with the registration time and the package id

## Why fields cannot overlap

The label is a stack of boxes with fixed positions. Text is never allowed to decide its own size:

- A single-line value is shrunk to fit its box; if it is still too wide at the smallest size it is cut and ends with `…`.
- Extra information is wrapped onto as many lines as its box holds, and cut with `…` after that. Its 120-character limit is chosen so normal text is never cut.

## Barcode or QR code

The tracking number is printed as a **Code128 barcode**. If the number is so long that the bars would become too thin to scan reliably (or it contains unusual characters), a **QR code** is printed instead. Hand scanners that read 2D codes read both.

## Sticker size

Default is 100 × 150 mm. To change it, set in `backend/.env` and restart:

```
LABEL_WIDTH_MM=62
LABEL_HEIGHT_MM=100
```

The layout and font sizes scale with the label. When printing, choose "actual size" (not "fit to page") in the print dialog and pick the matching paper size on the label printer.

## Characters

The labels use the PDF's built-in Helvetica font, which covers Western European characters including å, ä, ö. Other characters (for example Chinese or Cyrillic) are printed as `?`.

## For developers

Everything is in `app/services/labels.py`:

- `render_labels`, `render_summary_label`, `render_package_list` – return PDF bytes
- `_ROWS` – the share of the label height given to each row
- `fit_text`, `wrap_text` – the text fitting described above
