from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    DatabaseCreate,
    DatabaseResponse,
    DatabaseUpdate,
    FieldDefinitionCreate,
    FieldDefinitionResponse,
    FieldDefinitionUpdate,
    RecordCreate,
    RecordResponse,
    RecordUpdate,
    RecordValueResponse,
)
from app.services import database_client, supabase_client

router = APIRouter(prefix="/databases", tags=["databases"])


def _db_row(row: dict) -> DatabaseResponse:
    return DatabaseResponse(
        id=row["id"],
        name=row["name"],
        description=row.get("description"),
        created_at=row.get("created_at"),
    )


def _field_row(row: dict) -> FieldDefinitionResponse:
    return FieldDefinitionResponse(
        id=row["id"],
        database_id=row["database_id"],
        name=row["name"],
        field_type=row["field_type"],
        options=row.get("options"),
        sort_order=row.get("sort_order", 0),
        created_at=row.get("created_at"),
    )


def _record_row(row: dict) -> RecordResponse:
    values = [
        RecordValueResponse(
            field_id=v["field_id"],
            field_name=v.get("field_name"),
            field_type=v.get("field_type"),
            text_value=v.get("text_value"),
            number_value=v.get("number_value"),
            date_value=v.get("date_value"),
        )
        for v in row.get("values", [])
    ]
    return RecordResponse(
        id=row["id"],
        database_id=row["database_id"],
        molecule_id=row.get("molecule_id"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        values=values,
    )


async def _require_database(database_id: str) -> dict:
    row = await database_client.fetch_database(database_id)
    if not row:
        raise HTTPException(status_code=404, detail="Database not found")
    return row


async def _require_field(database_id: str, field_id: str) -> dict:
    row = await database_client.fetch_field_definition(field_id)
    if not row or row.get("database_id") != database_id:
        raise HTTPException(status_code=404, detail="Field not found")
    return row


async def _validate_molecule_id(molecule_id: str | None) -> None:
    if molecule_id is None:
        return
    mol = await supabase_client.fetch_molecule_by_id(molecule_id)
    if not mol:
        raise HTTPException(status_code=400, detail="molecule_id not found")


@router.get("", response_model=list[DatabaseResponse])
async def list_databases():
    try:
        rows = await database_client.list_databases()
        return [_db_row(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("", response_model=DatabaseResponse, status_code=201)
async def create_database(body: DatabaseCreate):
    try:
        row = await database_client.insert_database(
            name=body.name.strip(),
            description=body.description.strip() if body.description else None,
        )
        return _db_row(row)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/{database_id}", response_model=DatabaseResponse)
async def get_database(database_id: str):
    try:
        row = await database_client.fetch_database(database_id)
        if not row:
            raise HTTPException(status_code=404, detail="Database not found")
        return _db_row(row)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.patch("/{database_id}", response_model=DatabaseResponse)
async def patch_database(database_id: str, body: DatabaseUpdate):
    try:
        row = await database_client.update_database(
            database_id,
            name=body.name.strip() if body.name else None,
            description=body.description,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Database not found")
        return _db_row(row)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.delete("/{database_id}", status_code=204)
async def remove_database(database_id: str):
    try:
        ok = await database_client.delete_database(database_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Database not found")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/{database_id}/fields", response_model=list[FieldDefinitionResponse])
async def list_fields(database_id: str):
    await _require_database(database_id)
    try:
        rows = await database_client.list_field_definitions(database_id)
        return [_field_row(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post(
    "/{database_id}/fields",
    response_model=FieldDefinitionResponse,
    status_code=201,
)
async def create_field(database_id: str, body: FieldDefinitionCreate):
    await _require_database(database_id)
    try:
        row = await database_client.insert_field_definition(
            database_id,
            name=body.name.strip(),
            field_type=body.field_type.strip().lower(),
            options=body.options,
            sort_order=body.sort_order,
        )
        return _field_row(row)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.patch(
    "/{database_id}/fields/{field_id}",
    response_model=FieldDefinitionResponse,
)
async def patch_field(
    database_id: str,
    field_id: str,
    body: FieldDefinitionUpdate,
):
    await _require_field(database_id, field_id)
    try:
        row = await database_client.update_field_definition(
            field_id,
            name=body.name.strip() if body.name else None,
            field_type=body.field_type.strip().lower() if body.field_type else None,
            options=body.options,
            sort_order=body.sort_order,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Field not found")
        return _field_row(row)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.delete("/{database_id}/fields/{field_id}", status_code=204)
async def remove_field(database_id: str, field_id: str):
    await _require_field(database_id, field_id)
    try:
        ok = await database_client.delete_field_definition(field_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Field not found")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/{database_id}/records", response_model=list[RecordResponse])
async def list_records(database_id: str, limit: int = 500):
    await _require_database(database_id)
    try:
        rows = await database_client.list_records(
            database_id, limit=min(limit, 1000)
        )
        return [_record_row(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post(
    "/{database_id}/records",
    response_model=RecordResponse,
    status_code=201,
)
async def create_record(database_id: str, body: RecordCreate):
    await _require_database(database_id)
    await _validate_molecule_id(body.molecule_id)
    try:
        row = await database_client.insert_record(
            database_id,
            molecule_id=body.molecule_id,
            values=body.values,
        )
        return _record_row(row)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get(
    "/{database_id}/records/{record_id}",
    response_model=RecordResponse,
)
async def get_record(database_id: str, record_id: str):
    await _require_database(database_id)
    try:
        row = await database_client.fetch_record(record_id)
        if not row or row.get("database_id") != database_id:
            raise HTTPException(status_code=404, detail="Record not found")
        return _record_row(row)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.patch(
    "/{database_id}/records/{record_id}",
    response_model=RecordResponse,
)
async def patch_record(database_id: str, record_id: str, body: RecordUpdate):
    await _require_database(database_id)
    await _validate_molecule_id(body.molecule_id)
    try:
        existing = await database_client.fetch_record(record_id)
        if not existing or existing.get("database_id") != database_id:
            raise HTTPException(status_code=404, detail="Record not found")

        clear_mol = "molecule_id" in body.model_fields_set and body.molecule_id is None
        row = await database_client.update_record(
            record_id,
            molecule_id=body.molecule_id,
            values=body.values,
            clear_molecule=clear_mol,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Record not found")
        return _record_row(row)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.delete("/{database_id}/records/{record_id}", status_code=204)
async def remove_record(database_id: str, record_id: str):
    await _require_database(database_id)
    try:
        existing = await database_client.fetch_record(record_id)
        if not existing or existing.get("database_id") != database_id:
            raise HTTPException(status_code=404, detail="Record not found")
        ok = await database_client.delete_record(record_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Record not found")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
