"""Supabase REST access — backend holds service role key; frontend never writes SMILES."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings
from app.services.rdkit_service import MoleculeProperties


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


async def insert_molecule(props: MoleculeProperties) -> dict[str, Any]:
    payload = {
        "canonical_smiles": props.canonical_smiles,
        "molecular_weight": props.molecular_weight,
        "molecular_formula": props.molecular_formula,
        "morgan_fingerprint": props.morgan_fingerprint,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_base()}/molecules",
            headers=_headers(),
            json=payload,
        )
        if resp.status_code == 409:
            raise ValueError("Molecule already exists (duplicate canonical SMILES)")
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else rows


async def fetch_molecule_by_canonical_smiles(canonical_smiles: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "canonical_smiles": f"eq.{canonical_smiles}",
                "select": "*",
            },
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None


async def list_molecules(limit: int = 500) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={
                "select": "id,canonical_smiles,molecular_weight,molecular_formula,created_at",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        resp.raise_for_status()
        return resp.json()


async def fetch_all_molecules_for_substructure() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            f"{_base()}/molecules",
            headers=_headers(),
            params={"select": "id,canonical_smiles,molecular_weight,molecular_formula"},
        )
        resp.raise_for_status()
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
        resp.raise_for_status()
        return resp.json()
