"""Parse Excel spreadsheets for bulk molecule import."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import openpyxl

from app.services.compound_name_resolver import NameResolveError, resolve_smiles_from_name
from app.services.rdkit_service import (
    ImportErrorEntry,
    MoleculeProperties,
    RDKitError,
    canonicalize_smiles,
)

# Headers from MoleculeTable export + common aliases (case-insensitive)
_SMILES_HEADERS = frozenset(
    {
        "canonical smiles",
        "smiles",
        "canonical_smiles",
        "structure",
        "structure smiles",
    }
)
_MOLNAME_HEADERS = frozenset(
    {
        "molname",
        "mol name",
        "molecule name",
        "molecule_name",
    }
)
_NAME_HEADERS = frozenset({"name", "compound name", "compound", "compound_name"})
_NOTES_HEADERS = frozenset({"notes", "note", "comments", "comment", "remarks"})


@dataclass
class ExcelImportRow:
    props: MoleculeProperties
    excel_row: int
    name: str | None = None
    notes: str | None = None


@dataclass
class _RawExcelRow:
    excel_row: int
    smiles: str | None = None
    molname: str | None = None
    name: str | None = None
    notes: str | None = None


def _norm_header(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace("_", " ")


def _cell_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _find_column(headers: list[str], candidates: frozenset[str]) -> int | None:
    for i, h in enumerate(headers):
        if h in candidates:
            return i
    return None


def _find_lookup_column(headers: list[str]) -> int | None:
    """Column used to resolve structure when SMILES is absent (MOLNAME / compound name)."""
    col = _find_column(headers, _MOLNAME_HEADERS)
    if col is not None:
        return col
    return _find_column(headers, _NAME_HEADERS)


def _parse_excel_sheet(data: bytes) -> tuple[list[_RawExcelRow], list[str]]:
    """
    Read worksheet rows without network or RDKit work.
    Returns raw rows plus header labels for error messages.
    """
    try:
        workbook = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        raise RDKitError(f"Invalid Excel file: {e}") from e

    sheet = workbook.active
    if sheet is None:
        workbook.close()
        raise RDKitError("Workbook has no worksheets")

    row_iter = sheet.iter_rows(values_only=True)
    header_cells = next(row_iter, None)
    if not header_cells:
        workbook.close()
        raise RDKitError("Empty spreadsheet")

    headers = [_norm_header(c) for c in header_cells]
    smiles_col = _find_column(headers, _SMILES_HEADERS)
    lookup_col = _find_lookup_column(headers)
    if smiles_col is None and lookup_col is None:
        workbook.close()
        raise RDKitError(
            "No structure column found. Include 'SMILES' / 'Canonical SMILES' "
            "or 'MOLNAME' / 'Compound Name'."
        )

    name_col: int | None = None
    if smiles_col is not None and lookup_col is not None and lookup_col != smiles_col:
        name_col = lookup_col
    elif smiles_col is not None:
        alt = _find_column(headers, _MOLNAME_HEADERS)
        if alt is not None and alt != smiles_col:
            name_col = alt

    notes_col = _find_column(headers, _NOTES_HEADERS)

    raw_rows: list[_RawExcelRow] = []
    for offset, cells in enumerate(row_iter):
        excel_row = offset + 2
        smiles = (
            _cell_str(cells[smiles_col])
            if smiles_col is not None and smiles_col < len(cells)
            else None
        )
        molname = (
            _cell_str(cells[lookup_col])
            if lookup_col is not None and lookup_col < len(cells)
            else None
        )
        if not smiles and not molname:
            continue

        name = (
            _cell_str(cells[name_col])
            if name_col is not None and name_col < len(cells)
            else None
        )
        notes = (
            _cell_str(cells[notes_col])
            if notes_col is not None and notes_col < len(cells)
            else None
        )
        raw_rows.append(
            _RawExcelRow(
                excel_row=excel_row,
                smiles=smiles,
                molname=molname if not smiles else None,
                name=name or (molname if smiles else None),
                notes=notes,
            )
        )

    workbook.close()
    return raw_rows, headers


async def parse_excel_bytes(data: bytes) -> tuple[list[ExcelImportRow], list[ImportErrorEntry]]:
    """
    Read first worksheet.

    Supports either:
    - SMILES column (optional Name / Notes), or
    - MOLNAME / compound name column only — resolves SMILES via PubChem/CIR,
      then canonicalizes with RDKit before import.
    """
    raw_rows, _headers = _parse_excel_sheet(data)
    if not raw_rows:
        raise RDKitError("No data rows with SMILES or MOLNAME found")

    rows: list[ExcelImportRow] = []
    errors: list[ImportErrorEntry] = []

    for raw in raw_rows:
        stored_name = raw.name or raw.molname
        try:
            if raw.smiles:
                props = canonicalize_smiles(raw.smiles)
            else:
                assert raw.molname is not None
                fetched_smiles = await resolve_smiles_from_name(raw.molname)
                props = canonicalize_smiles(fetched_smiles)
                if stored_name is None:
                    stored_name = raw.molname
            rows.append(
                ExcelImportRow(
                    props=props,
                    excel_row=raw.excel_row,
                    name=stored_name,
                    notes=raw.notes,
                )
            )
        except NameResolveError as e:
            errors.append(ImportErrorEntry(index=raw.excel_row, reason=str(e)))
        except RDKitError as e:
            errors.append(ImportErrorEntry(index=raw.excel_row, reason=str(e)))

    if not rows and not errors:
        raise RDKitError("No importable rows found")

    return rows, errors
