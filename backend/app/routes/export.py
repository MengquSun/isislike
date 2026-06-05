from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.config import settings
from app.models.schemas import (
    EXPORT_ATTRIBUTES,
    EXPORT_FIELD_SORTS,
    EXPORT_FORMATS,
    ExportConfigResponse,
    ExportCustomRequest,
    ExportPreviewChemical,
    ExportPreviewRequest,
    ExportPreviewResponse,
)
from app.services import export_service
from app.services.export_auth import require_export_access

router = APIRouter(prefix="/export", tags=["export"])


def _row_to_preview(row: dict) -> ExportPreviewChemical:
    return ExportPreviewChemical(
        id=row["id"],
        name=row.get("name"),
        canonical_smiles=row["canonical_smiles"],
        formula=row.get("molecular_formula"),
    )


@router.get("/config", response_model=ExportConfigResponse)
async def export_config():
    """Tell the frontend whether export is available and if a key is required."""
    return ExportConfigResponse(
        enabled=settings.export_enabled,
        require_key=bool(settings.export_api_key),
    )


@router.post("/preview", response_model=ExportPreviewResponse)
async def preview_export(
    body: ExportPreviewRequest,
    _: None = Depends(require_export_access),
):
    """Preview molecules matching export filters."""
    filters = body.filters
    try:
        rows = await export_service.search_for_preview(
            canonical_smiles=filters.canonical_smiles,
            formula=filters.formula,
            name=filters.name,
            all_chemicals=body.all_chemicals,
        )
        return ExportPreviewResponse(chemicals=[_row_to_preview(r) for r in rows])
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/custom")
async def custom_export(
    body: ExportCustomRequest,
    _: None = Depends(require_export_access),
):
    """Generate custom XLSX or CSV (zip) with one sheet/file per molecule."""
    invalid = [a for a in body.attributes if a not in EXPORT_ATTRIBUTES]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid attributes: {', '.join(invalid)}",
        )
    if body.format not in EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format: {body.format}. Use xlsx or csv.",
        )
    if body.field_sort not in EXPORT_FIELD_SORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid field_sort: {body.field_sort}",
        )

    try:
        content, media_type, filename = await export_service.build_custom_export(
            body.chemical_ids,
            body.attributes,
            fmt=body.format,
            field_sort=body.field_sort,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
