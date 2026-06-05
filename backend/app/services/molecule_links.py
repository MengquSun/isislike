"""Attach dynamic-database records to molecule API responses."""

from __future__ import annotations

from app.models.schemas import (
    LinkedDatabaseRecord,
    MoleculeDatabaseRecordResponse,
    MoleculeResponse,
    RecordValueResponse,
)
from app.services import database_client


def _linked_from_flat(item: dict) -> LinkedDatabaseRecord:
    values = [
        RecordValueResponse(
            field_id=v["field_id"],
            field_name=v.get("field_name"),
            field_type=v.get("field_type"),
            text_value=v.get("text_value"),
            number_value=v.get("number_value"),
            date_value=v.get("date_value"),
        )
        for v in item.get("values", [])
    ]
    return LinkedDatabaseRecord(
        record_id=item["record_id"],
        database_id=item["database_id"],
        database_name=item.get("database_name") or "Database",
        canonical_smiles=item.get("canonical_smiles") or "",
        created_at=item.get("created_at"),
        updated_at=item.get("updated_at"),
        values=values,
    )


def _molecule_db_record_from_flat(item: dict) -> MoleculeDatabaseRecordResponse:
    linked = _linked_from_flat(item)
    return MoleculeDatabaseRecordResponse(
        id=linked.record_id,
        molecule_id=item.get("molecule_id") or "",
        source_database=linked.database_name,
        database_id=linked.database_id,
        created_at=linked.created_at,
        updated_at=linked.updated_at,
        values=linked.values,
    )


async def attach_linked_database_records(
    molecules: list[MoleculeResponse],
) -> list[MoleculeResponse]:
    if not molecules:
        return molecules
    grouped = await database_client.fetch_records_by_molecule_ids(
        [m.id for m in molecules]
    )
    return [
        m.model_copy(
            update={
                "linked_database_records": [
                    _linked_from_flat(item) for item in grouped.get(m.id, [])
                ]
            }
        )
        for m in molecules
    ]


async def fetch_molecule_database_records(
    molecule_id: str,
    *,
    source_database: str | None = None,
    field_name: str | None = None,
    keyword: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[MoleculeDatabaseRecordResponse]:
    rows = await database_client.fetch_records_for_molecule(
        molecule_id,
        source_database=source_database,
        field_name=field_name,
        keyword=keyword,
        date_from=date_from,
        date_to=date_to,
    )
    return [_molecule_db_record_from_flat(row) for row in rows]
