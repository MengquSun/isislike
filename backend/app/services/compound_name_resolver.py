"""Resolve compound names to SMILES via PubChem and CIR (NCI Cactus)."""

from __future__ import annotations

import urllib.parse

import httpx

PUBCHEM_NAME_URL = (
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/property/CanonicalSMILES/JSON"
)
CIR_SMILES_URL = "https://cactus.nci.nih.gov/chemical/structure/{name}/smiles"
REQUEST_TIMEOUT = 30.0


class NameResolveError(ValueError):
    """Compound name could not be resolved to SMILES."""


async def resolve_smiles_from_name(name: str) -> str:
    """
    Look up SMILES for a compound name or identifier.
    Tries PubChem first, then CIR (NCI Chemical Identifier Resolver).
    """
    query = name.strip()
    if not query:
        raise NameResolveError("Empty compound name")

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        smiles = await _pubchem_smiles(client, query)
        if smiles:
            return smiles
        smiles = await _cir_smiles(client, query)
        if smiles:
            return smiles

    raise NameResolveError(f"No SMILES found for '{query}' (PubChem and CIR)")


async def _pubchem_smiles(client: httpx.AsyncClient, name: str) -> str | None:
    encoded = urllib.parse.quote(name, safe="")
    url = PUBCHEM_NAME_URL.format(name=encoded)
    try:
        response = await client.get(url)
    except httpx.HTTPError:
        return None
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        return None
    try:
        payload = response.json()
        props = payload.get("PropertyTable", {}).get("Properties", [])
        if not props:
            return None
        smiles = props[0].get("CanonicalSMILES") or props[0].get("ConnectivitySMILES")
        return str(smiles).strip() if smiles else None
    except (ValueError, KeyError, TypeError):
        return None


async def _cir_smiles(client: httpx.AsyncClient, name: str) -> str | None:
    encoded = urllib.parse.quote(name, safe="")
    url = CIR_SMILES_URL.format(name=encoded)
    try:
        response = await client.get(url)
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    text = response.text.strip()
    if not text or text.lower().startswith("error"):
        return None
    # CIR may return multiple SMILES separated by newline; take the first.
    return text.splitlines()[0].strip()
