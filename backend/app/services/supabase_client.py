"""Supabase REST access — backend holds service role key; frontend never writes SMILES."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings
from app.services.rdkit_service import MoleculeProperties

MOLECULE_LIST_SELECT = (
    "id,canonical_smiles,molecular_weight,molecular_formula,"
    "name,notes,created_at,updated_at"
)
MOLECULE_DETAIL_SELECT = (
    "id,canonical_smiles,molecular_weight,molecular_formula,"
    "name,notes,molfile,structure_svg,created_at,updated_at"
)

_MIGRATION_002_HINT = (
    "Run supabase/migrations/002_phase1_5_molecule_fields.sql in the Supabase SQL Editor."
)


def _check_response(resp: httpx.Response) -> None:
    """Turn Supabase/PostgREST errors into RuntimeError (routes map to HTTPException + CORS)."""
    if resp.is_success:
        return
    body = resp.text
    if resp.status_code == 400 and (
        "column" in body.lower()
        or "does not exist" in body.lower()
        or "name" in body
    ):
        raise RuntimeError(
            f"Supabase schema missing Phase 1.5 columns. {_MIGRATION_002_HINT} "
            f"({body[:240]})"
        )
    raise RuntimeError(f"Supabase error ({resp.status_code}): {body[:500]}")


def _headers() -> dict[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _base() -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1"


def _molecule_payload(props: MoleculeProperties, *, name: str | None = None, notes: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "canonical_smiles": props.canonical_smiles,
        "molecular_weight": props.molecular_weight,
        "molecular_formula": props.molecular_formula,
        "morgan_fingerprint": props.morgan_fingerprint,
    }
    if props.molfile is not None:
        payload["molfile"] = props.molfile
    if props.structure_svg is not None:
        payload["structure_svg"] = props.structure_svg
    if name is not None:
        payload["name"] = name
    if notes is not None:
        payload["notes"] = notes
    return payload


async def insert_molecule(
    props: MoleculeProperties,
    *,
    name: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    payload = _molecule_payload(props, name=name, notes=notes)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_base()}/molecules",
            headers=_headers(),
            json=payload,
        )
        if resp.status_code == 409:
            raise ValueError("Molecule already exists (duplicate canonical SMILES)")
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def fetch_molecule_by_id(molecule_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "id": f"eq.{molecule_id}",
                "select": MOLECULE_DETAIL_SELECT,
            },
        )
        _check_response(resp)
        rows = resp.json()
        return rows[0] if rows else None


async def fetch_molecule_by_canonical_smiles(canonical_smiles: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "canonical_smiles": f"eq.{canonical_smiles}",
                "select": MOLECULE_DETAIL_SELECT,
            },
        )
        _check_response(resp)
        rows = resp.json()
        return rows[0] if rows else None


async def update_molecule(
    molecule_id: str,
    *,
    name: str | None = None,
    notes: str | None = None,
) -> dict[str, Any] | None:
    patch: dict[str, Any] = {}
    if name is not None:
        patch["name"] = name
    if notes is not None:
        patch["notes"] = notes
    if not patch:
        return await fetch_molecule_by_id(molecule_id)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.patch(
            f"{_base()}/molecules",
            headers=_headers(),
            params={"id": f"eq.{molecule_id}"},
            json=patch,
        )
        if resp.status_code == 404:
            return None
        _check_response(resp)
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def delete_molecule(molecule_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            f"{_base()}/molecules",
            headers={**_headers(), "Prefer": "return=minimal"},
            params={"id": f"eq.{molecule_id}"},
        )
        if resp.status_code == 404:
            return False
        _check_response(resp)
        return True


async def list_molecules(limit: int = 500) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "select": MOLECULE_LIST_SELECT,
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        _check_response(resp)
        return resp.json()


async def fetch_all_molecules_for_substructure() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "select": "id,canonical_smiles,molecular_weight,molecular_formula,name"
            },
        )
        _check_response(resp)
        return resp.json()


async def search_similar_molecules(
    query_fingerprint: list[float],
    match_threshold: float = 0.7,
    match_count: int = 50,
) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/search_molecules_by_similarity",
            headers=_headers(),
            json={
                "query_fingerprint": query_fingerprint,
                "match_threshold": match_threshold,
                "match_count": match_count,
            },
        )
        _check_response(resp)
        return resp.json()
