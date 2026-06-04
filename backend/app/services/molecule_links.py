"""Attach dynamic-database records to molecule API responses."""

from __future__ import annotations

from app.models.schemas import (
    LinkedDatabaseRecord,
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
        values=values,
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
