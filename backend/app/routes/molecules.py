from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CanonicalizeResponse,
    MoleculeResponse,
    SaveMoleculeRequest,
    SimilaritySearchRequest,
    SmartsInput,
    SmilesInput,
)
from app.services import rdkit_service, supabase_client
from app.services.rdkit_service import RDKitError

router = APIRouter(prefix="/molecules", tags=["molecules"])


@router.get("", response_model=list[MoleculeResponse])
async def list_molecules(limit: int = 500):
    """List all registered molecules (newest first)."""
    try:
        rows = await supabase_client.list_molecules(limit=min(limit, 1000))
        return [
            MoleculeResponse(
                id=r["id"],
                canonical_smiles=r["canonical_smiles"],
                molecular_weight=r.get("molecular_weight"),
                molecular_formula=r.get("molecular_formula"),
            )
            for r in rows
        ]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _to_canonical_response(props) -> CanonicalizeResponse:
    return CanonicalizeResponse(
        canonical_smiles=props.canonical_smiles,
        molecular_weight=props.molecular_weight,
        molecular_formula=props.molecular_formula,
        morgan_fingerprint=props.morgan_fingerprint,
    )


@router.post("/canonicalize", response_model=CanonicalizeResponse)
async def canonicalize(body: SmilesInput):
    """Action 1 helper: canonicalize raw SMILES without persisting."""
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        return _to_canonical_response(props)
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/save", response_model=MoleculeResponse)
async def save_molecule(body: SaveMoleculeRequest):
    """
    Action 1: Draw & Save.
    Ketcher SMILES -> RDKit canonicalize -> Supabase insert (UNIQUE on canonical_smiles).
    """
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        row = await supabase_client.insert_molecule(props)
        return MoleculeResponse(
            id=row["id"],
            canonical_smiles=row["canonical_smiles"],
            molecular_weight=row.get("molecular_weight"),
            molecular_formula=row.get("molecular_formula"),
        )
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/search/exact", response_model=MoleculeResponse | None)
async def exact_search(body: SmilesInput):
    """
    Action 2: Exact search via canonical SMILES lookup.
    """
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        row = await supabase_client.fetch_molecule_by_canonical_smiles(
            props.canonical_smiles
        )
        if row is None:
            return None
        return MoleculeResponse(
            id=row["id"],
            canonical_smiles=row["canonical_smiles"],
            molecular_weight=row.get("molecular_weight"),
            molecular_formula=row.get("molecular_formula"),
        )
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/search/substructure", response_model=list[MoleculeResponse])
async def substructure_search(body: SmartsInput):
    """
    Action 3: Substructure search.
    Fetch candidates from Supabase, filter with RDKit HasSubstructMatch.
    """
    try:
        query_smarts = body.smarts
        rdkit_service.validate_smarts(query_smarts)
        candidates = await supabase_client.fetch_all_molecules_for_substructure()
        results: list[MoleculeResponse] = []
        for row in candidates:
            smiles = row.get("canonical_smiles")
            if not smiles:
                continue
            if rdkit_service.has_substructure_match(smiles, query_smarts):
                results.append(
                    MoleculeResponse(
                        id=row["id"],
                        canonical_smiles=smiles,
                        molecular_weight=row.get("molecular_weight"),
                        molecular_formula=row.get("molecular_formula"),
                    )
                )
        return results
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/search/similarity", response_model=list[MoleculeResponse])
async def similarity_search(body: SimilaritySearchRequest):
    """
    Action 4: Similarity search via pgvector RPC (Tanimoto / cosine distance).
    """
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        rows = await supabase_client.search_similar_molecules(
            props.morgan_fingerprint,
            match_threshold=body.match_threshold,
            match_count=body.match_count,
        )
        return [
            MoleculeResponse(
                id=r["id"],
                canonical_smiles=r["canonical_smiles"],
                molecular_weight=r.get("molecular_weight"),
                molecular_formula=r.get("molecular_formula"),
                similarity=r.get("similarity"),
            )
            for r in rows
        ]
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
