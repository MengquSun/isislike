"""Supabase REST for Phase 2A databases, fields, and records."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings
from app.models.schemas import FIELD_TYPES_MVP

_MIGRATION_003_HINT = (
    "Run supabase/migrations/003_phase2a_dynamic_fields.sql in the Supabase SQL Editor."
)

RECORD_SELECT = "id,database_id,molecule_id,created_at,updated_at"
RECORD_WITH_VALUES_SELECT = (
    f"{RECORD_SELECT},"
    "record_values(id,field_id,text_value,number_value,date_value,structure_molecule_id,"
    "field_definitions(id,name,field_type))"
)


def _check_response(resp: httpx.Response) -> None:
    if resp.is_success:
        return
    body = resp.text
    if resp.status_code in (400, 404) and (
        "does not exist" in body.lower()
        or "relation" in body.lower()
        or "databases" in body.lower()
    ):
        raise RuntimeError(
            f"Supabase schema missing Phase 2A tables. {_MIGRATION_003_HINT} "
            f"({body[:240]})"
        )
    raise RuntimeError(f"Supabase error ({resp.status_code}): {body[:500]}")


def _headers(*, prefer: str | None = None) -> dict[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    h = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": prefer or "return=representation",
    }
    return h


def _base() -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1"


def _value_payload(
    field_type: str,
    raw: str | int | float | None,
) -> dict[str, Any]:
    if raw is None or raw == "":
        return {
            "text_value": None,
            "number_value": None,
            "date_value": None,
        }
    if field_type == "text" or field_type == "select":
        return {"text_value": str(raw), "number_value": None, "date_value": None}
    if field_type == "number":
        return {
            "text_value": None,
            "number_value": float(raw),
            "date_value": None,
        }
    if field_type == "date":
        return {
            "text_value": None,
            "number_value": None,
            "date_value": str(raw),
        }
    raise ValueError(f"Unsupported field type: {field_type}")


def _flatten_record_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize PostgREST nested record_values for API responses."""
    values_raw = row.pop("record_values", None) or []
    values: list[dict[str, Any]] = []
    for rv in values_raw:
        fd = rv.get("field_definitions") or {}
        if isinstance(fd, list) and fd:
            fd = fd[0]
        values.append(
            {
                "field_id": rv.get("field_id"),
                "field_name": fd.get("name"),
                "field_type": fd.get("field_type"),
                "text_value": rv.get("text_value"),
                "number_value": rv.get("number_value"),
                "date_value": rv.get("date_value"),
            }
        )
    row["values"] = values
    return row


# --- databases ---


async def list_databases() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/databases",
            headers=_headers(),
            params={"select": "id,name,description,created_at", "order": "created_at.desc"},
        )
        _check_response(resp)
        return resp.json()


async def fetch_database(database_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/databases",
            headers=_headers(),
            params={"id": f"eq.{database_id}", "select": "id,name,description,created_at"},
        )
        _check_response(resp)
        rows = resp.json()
        return rows[0] if rows else None


async def insert_database(*, name: str, description: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"name": name}
    if description is not None:
        payload["description"] = description
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_base()}/databases",
            headers=_headers(),
            json=payload,
        )
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def update_database(
    database_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
) -> dict[str, Any] | None:
    patch: dict[str, Any] = {}
    if name is not None:
        patch["name"] = name
    if description is not None:
        patch["description"] = description
    if not patch:
        return await fetch_database(database_id)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.patch(
            f"{_base()}/databases",
            headers=_headers(),
            params={"id": f"eq.{database_id}"},
            json=patch,
        )
        if resp.status_code == 404:
            return None
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def delete_database(database_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            f"{_base()}/databases",
            headers=_headers(prefer="return=minimal"),
            params={"id": f"eq.{database_id}"},
        )
        if resp.status_code == 404:
            return False
        _check_response(resp)
        return True


# --- field_definitions ---


async def list_field_definitions(database_id: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/field_definitions",
            headers=_headers(),
            params={
                "database_id": f"eq.{database_id}",
                "select": "id,database_id,name,field_type,options,sort_order,created_at",
                "order": "sort_order.asc,name.asc",
            },
        )
        _check_response(resp)
        return resp.json()


async def fetch_field_definition(field_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/field_definitions",
            headers=_headers(),
            params={
                "id": f"eq.{field_id}",
                "select": "id,database_id,name,field_type,options,sort_order,created_at",
            },
        )
        _check_response(resp)
        rows = resp.json()
        return rows[0] if rows else None


async def insert_field_definition(
    database_id: str,
    *,
    name: str,
    field_type: str,
    options: dict | None = None,
    sort_order: int = 0,
) -> dict[str, Any]:
    if field_type not in FIELD_TYPES_MVP:
        raise ValueError(f"field_type must be one of: {', '.join(sorted(FIELD_TYPES_MVP))}")
    if field_type == "select" and not (options and options.get("choices")):
        raise ValueError("select fields require options.choices (non-empty list)")

    payload: dict[str, Any] = {
        "database_id": database_id,
        "name": name,
        "field_type": field_type,
        "sort_order": sort_order,
    }
    if options is not None:
        payload["options"] = options

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_base()}/field_definitions",
            headers=_headers(),
            json=payload,
        )
        if resp.status_code == 409:
            raise ValueError("Field name already exists in this database")
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def update_field_definition(
    field_id: str,
    *,
    name: str | None = None,
    field_type: str | None = None,
    options: dict | None = None,
    sort_order: int | None = None,
) -> dict[str, Any] | None:
    if field_type is not None and field_type not in FIELD_TYPES_MVP:
        raise ValueError(f"field_type must be one of: {', '.join(sorted(FIELD_TYPES_MVP))}")

    patch: dict[str, Any] = {}
    if name is not None:
        patch["name"] = name
    if field_type is not None:
        patch["field_type"] = field_type
    if options is not None:
        patch["options"] = options
    if sort_order is not None:
        patch["sort_order"] = sort_order
    if not patch:
        return await fetch_field_definition(field_id)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.patch(
            f"{_base()}/field_definitions",
            headers=_headers(),
            params={"id": f"eq.{field_id}"},
            json=patch,
        )
        if resp.status_code == 404:
            return None
        if resp.status_code == 409:
            raise ValueError("Field name already exists in this database")
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def delete_field_definition(field_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            f"{_base()}/field_definitions",
            headers=_headers(prefer="return=minimal"),
            params={"id": f"eq.{field_id}"},
        )
        if resp.status_code == 404:
            return False
        _check_response(resp)
        return True


# --- records ---


async def list_records(database_id: str, *, limit: int = 500) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            f"{_base()}/records",
            headers=_headers(),
            params={
                "database_id": f"eq.{database_id}",
                "select": RECORD_WITH_VALUES_SELECT,
                "order": "updated_at.desc",
                "limit": str(limit),
            },
        )
        _check_response(resp)
        return [_flatten_record_row(dict(r)) for r in resp.json()]


async def fetch_record(record_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/records",
            headers=_headers(),
            params={
                "id": f"eq.{record_id}",
                "select": RECORD_WITH_VALUES_SELECT,
            },
        )
        _check_response(resp)
        rows = resp.json()
        if not rows:
            return None
        return _flatten_record_row(dict(rows[0]))


async def _insert_record_values(
    client: httpx.AsyncClient,
    record_id: str,
    fields_by_id: dict[str, dict[str, Any]],
    values: dict[str, str | int | float | None],
) -> None:
    payloads: list[dict[str, Any]] = []
    for field_id, raw in values.items():
        fd = fields_by_id.get(field_id)
        if not fd:
            raise ValueError(f"Unknown field_id: {field_id}")
        col = _value_payload(fd["field_type"], raw)
        payloads.append({"record_id": record_id, "field_id": field_id, **col})

    if not payloads:
        return

    resp = await client.post(
        f"{_base()}/record_values",
        headers=_headers(),
        json=payloads,
    )
    _check_response(resp)


async def _replace_record_values(
    client: httpx.AsyncClient,
    record_id: str,
    fields_by_id: dict[str, dict[str, Any]],
    values: dict[str, str | int | float | None],
) -> None:
    del_resp = await client.delete(
        f"{_base()}/record_values",
        headers=_headers(prefer="return=minimal"),
        params={"record_id": f"eq.{record_id}"},
    )
    _check_response(del_resp)
    await _insert_record_values(client, record_id, fields_by_id, values)


async def insert_record(
    database_id: str,
    *,
    molecule_id: str | None = None,
    values: dict[str, str | int | float | None],
) -> dict[str, Any]:
    fields = await list_field_definitions(database_id)
    fields_by_id = {f["id"]: f for f in fields}

    payload: dict[str, Any] = {"database_id": database_id}
    if molecule_id is not None:
        payload["molecule_id"] = molecule_id

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{_base()}/records",
            headers=_headers(),
            json=payload,
        )
        _check_response(resp)
        rows = resp.json()
        record = rows[0] if isinstance(rows, list) and rows else rows
        record_id = record["id"]

        await _insert_record_values(client, record_id, fields_by_id, values)

    full = await fetch_record(record_id)
    return full or record


async def update_record(
    record_id: str,
    *,
    molecule_id: str | None = None,
    values: dict[str, str | int | float | None] | None = None,
    clear_molecule: bool = False,
) -> dict[str, Any] | None:
    existing = await fetch_record(record_id)
    if not existing:
        return None

    patch: dict[str, Any] = {}
    if clear_molecule:
        patch["molecule_id"] = None
    elif molecule_id is not None:
        patch["molecule_id"] = molecule_id

    async with httpx.AsyncClient(timeout=60.0) as client:
        if patch:
            resp = await client.patch(
                f"{_base()}/records",
                headers=_headers(),
                params={"id": f"eq.{record_id}"},
                json=patch,
            )
            if resp.status_code == 404:
                return None
            _check_response(resp)

        if values is not None:
            fields = await list_field_definitions(existing["database_id"])
            fields_by_id = {f["id"]: f for f in fields}
            await _replace_record_values(client, record_id, fields_by_id, values)

    return await fetch_record(record_id)


async def delete_record(record_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            f"{_base()}/records",
            headers=_headers(prefer="return=minimal"),
            params={"id": f"eq.{record_id}"},
        )
        if resp.status_code == 404:
            return False
        _check_response(resp)
        return True
