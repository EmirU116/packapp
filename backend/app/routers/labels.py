from enum import StrEnum

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Package
from app.services import labels
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/labels", tags=["labels"], dependencies=[Depends(get_current_user)])


class LabelOutput(StrEnum):
    # one label per package (single register prints this with one package)
    LABELS = "labels"
    # one label showing how many packages there are
    SUMMARY = "summary"
    # A4 paper list of all the packages
    LIST = "list"


_RENDERERS = {
    LabelOutput.LABELS: labels.render_labels,
    LabelOutput.SUMMARY: labels.render_summary_label,
    LabelOutput.LIST: labels.render_package_list,
}


@router.get("", response_class=Response, responses={200: {"content": {"application/pdf": {}}}})
def print_packages(
    ids: list[int] = Query(min_length=1, max_length=200),
    output: LabelOutput = LabelOutput.LABELS,
    db: Session = Depends(get_db),
):
    """
    A printable PDF for the given packages, e.g. `?ids=4&ids=5&output=list`.

    It is a GET so the browser can open it directly in a new tab and print.
    The packages appear in the order the ids are given.
    """
    found = {p.id: p for p in db.scalars(select(Package).where(Package.id.in_(ids)))}
    missing = [i for i in ids if i not in found]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Package not found: {missing[0]}")

    pdf = _RENDERERS[output]([found[i] for i in ids])
    return Response(
        pdf,
        media_type="application/pdf",
        # inline: show in the browser's PDF viewer instead of downloading
        headers={"Content-Disposition": f'inline; filename="packapp-{output}.pdf"'},
    )
