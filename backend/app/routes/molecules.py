from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.models.schemas import (
    CanonicalizeResponse,
    ImportErrorItem,
    ImportResponse,
    MoleculeDetailResponse,
    MoleculeResponse,
    SaveMoleculeRequest,
    SimilaritySearchRequest,
    SmartsInput,
    SmilesInput,
    UpdateMoleculeRequest,
)
from app.services import excel_import, molecule_links, rdkit_service, supabase_client
from app.services.rdkit_service import RDKitError

router = APIRouter(prefix="/molecules", tags=["molecules"])


def _row_to_response(row: dict, *, similarity: float | None = None) -> MoleculeResponse:
    return MoleculeResponse(
        id=row["id"],
        canonical_smiles=row["canonical_smiles"],
        molecular_weight=row.get("molecular_weight"),
        molecular_formula=row.get("molecular_formula"),
        similarity=similarity,
        name=row.get("name"),
        notes=row.get("notes"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_detail(row: dict) -> MoleculeDetailResponse:
    base = _row_to_response(row)
    return MoleculeDetailResponse(
        **base.model_dump(),
        has_structure_svg=bool(row.get("structure_svg")),
    )


@router.get("", response_model=list[MoleculeResponse])
async def list_molecules(limit: int = 500):
    """List all registered molecules (newest first)."""
    try:
        rows = await supabase_client.list_molecules(limit=min(limit, 1000))
        responses = [_row_to_response(r) for r in rows]
        return await molecule_links.attach_linked_database_records(responses)
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
    Draw & Save: Ketcher SMILES -> RDKit canonicalize + SVG -> Supabase insert.
    """
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles, molfile=body.molfile)
        row = await supabase_client.insert_molecule(
            props, name=body.name, notes=body.notes
        )
        attached = await molecule_links.attach_linked_database_records(
            [_row_to_response(row)]
        )
        return attached[0]
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


async def _import_props_batch(
    items: list[tuple[rdkit_service.MoleculeProperties, str | None, str | None]],
    errors: list[ImportErrorItem],
    *,
    row_index: int = -1,
) -> int:
    success_count = 0
    for props, name, notes in items:
        try:
            await supabase_client.insert_molecule(props, name=name, notes=notes)
            success_count += 1
        except ValueError:
            errors.append(
                ImportErrorItem(
                    index=row_index,
                    reason=f"Duplicate SMILES: {props.canonical_smiles}",
                )
            )
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
    return success_count


@router.post("/import", response_model=ImportResponse)
async def import_molecules(file: UploadFile = File(...)):
    """
    Import .mol, .sdf, or .xlsx (Excel).
    Structures are canonicalized with RDKit; fingerprint and SVG are stored.
    Excel: first sheet must include a SMILES column; optional Name / Notes.
    """
    filename = (file.filename or "").lower()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    errors: list[ImportErrorItem] = []
    success_count = 0

    try:
        if filename.endswith((".xlsx", ".xlsm")):
            excel_rows, parse_errors = excel_import.parse_excel_bytes(data)
            errors.extend(
                ImportErrorItem(index=e.index, reason=e.reason) for e in parse_errors
            )
            batch = [(r.props, r.name, r.notes) for r in excel_rows]
            success_count = await _import_props_batch(batch, errors)
        elif filename.endswith(".sdf") or b"$$$$" in data[:4096]:
            props_list, parse_errors = rdkit_service.parse_sdf_bytes(data)
            errors.extend(
                ImportErrorItem(index=e.index, reason=e.reason) for e in parse_errors
            )
            batch = [(p, None, None) for p in props_list]
            success_count = await _import_props_batch(batch, errors)
        elif filename.endswith(".mol") or b"M  END" in data or b"V2000" in data or b"V3000" in data:
            props = rdkit_service.parse_molfile_bytes(data)
            try:
                await supabase_client.insert_molecule(props)
                success_count = 1
            except ValueError as e:
                raise HTTPException(status_code=409, detail=str(e)) from e
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Upload .mol, .sdf, or .xlsx",
            )
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return ImportResponse(
        success_count=success_count,
        failed_count=len(errors),
        errors=errors,
    )


@router.post("/search/exact", response_model=MoleculeResponse | None)
async def exact_search(body: SmilesInput):
    """Exact search via canonical SMILES lookup."""
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        row = await supabase_client.fetch_molecule_by_canonical_smiles(
            props.canonical_smiles
        )
        if row is None:
            return None
        attached = await molecule_links.attach_linked_database_records(
            [_row_to_response(row)]
        )
        return attached[0]
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/search/substructure", response_model=list[MoleculeResponse])
async def substructure_search(body: SmartsInput):
    """Substructure search: RDKit HasSubstructMatch over DB candidates."""
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
                results.append(_row_to_response(row))
        return await molecule_links.attach_linked_database_records(results)
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/search/similarity", response_model=list[MoleculeResponse])
async def similarity_search(body: SimilaritySearchRequest):
    """Similarity search via pgvector RPC (Tanimoto / cosine distance)."""
    try:
        props = rdkit_service.canonicalize_smiles(body.smiles)
        rows = await supabase_client.search_similar_molecules(
            props.morgan_fingerprint,
            match_threshold=body.match_threshold,
            match_count=body.match_count,
        )
        responses = [
            _row_to_response(r, similarity=r.get("similarity"))
            for r in rows
        ]
        return await molecule_links.attach_linked_database_records(responses)
    except RDKitError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/{molecule_id}", response_model=MoleculeDetailResponse)
async def get_molecule(molecule_id: str):
    """View a single compound record."""
    try:
        row = await supabase_client.fetch_molecule_by_id(molecule_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if row is None:
        raise HTTPException(status_code=404, detail="Molecule not found")
    detail = _row_to_detail(row)
    attached = await molecule_links.attach_linked_database_records(
        [MoleculeResponse(**detail.model_dump(exclude={"has_structure_svg"}))]
    )
    base = attached[0]
    return MoleculeDetailResponse(
        **base.model_dump(),
        has_structure_svg=detail.has_structure_svg,
    )


@router.patch("/{molecule_id}", response_model=MoleculeResponse)
async def update_molecule(molecule_id: str, body: UpdateMoleculeRequest):
    """Update name and notes (structure unchanged in Phase 1.5)."""
    if body.name is None and body.notes is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        row = await supabase_client.update_molecule(
            molecule_id, name=body.name, notes=body.notes
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if row is None:
        raise HTTPException(status_code=404, detail="Molecule not found")
    return _row_to_response(row)


@router.delete("/{molecule_id}", status_code=204)
async def delete_molecule(molecule_id: str):
    """Delete a compound record."""
    try:
        deleted = await supabase_client.delete_molecule(molecule_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Molecule not found")


@router.get("/{molecule_id}/structure.svg")
async def get_structure_svg(molecule_id: str):
    """Return stored 2D structure SVG, or generate from canonical SMILES if missing."""
    try:
        row = await supabase_client.fetch_molecule_by_id(molecule_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if row is None:
        raise HTTPException(status_code=404, detail="Molecule not found")

    svg = row.get("structure_svg")
    if not svg:
        smiles = row.get("canonical_smiles")
        if not smiles:
            raise HTTPException(status_code=404, detail="No structure available")
        try:
            props = rdkit_service.properties_from_canonical_smiles(smiles)
            svg = props.structure_svg
        except RDKitError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )
