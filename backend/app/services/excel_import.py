"""Parse Excel spreadsheets for bulk molecule import."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import openpyxl

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
_NAME_HEADERS = frozenset({"name", "compound name", "compound", "compound_name"})
_NOTES_HEADERS = frozenset({"notes", "note", "comments", "comment", "remarks"})


@dataclass
class ExcelImportRow:
    props: MoleculeProperties
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


def parse_excel_bytes(data: bytes) -> tuple[list[ExcelImportRow], list[ImportErrorEntry]]:
    """
    Read first worksheet; require a SMILES column.
    Optional Name and Notes columns match export / ISIS-style sheets.
    """
    try:
        workbook = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        raise RDKitError(f"Invalid Excel file: {e}") from e

    sheet = workbook.active
    if sheet is None:
        raise RDKitError("Workbook has no worksheets")

    row_iter = sheet.iter_rows(values_only=True)
    header_cells = next(row_iter, None)
    if not header_cells:
        raise RDKitError("Empty spreadsheet")

    headers = [_norm_header(c) for c in header_cells]
    smiles_col = _find_column(headers, _SMILES_HEADERS)
    if smiles_col is None:
        raise RDKitError(
            "No SMILES column found. Use a header such as 'Canonical SMILES' or 'SMILES'."
        )
    name_col = _find_column(headers, _NAME_HEADERS)
    notes_col = _find_column(headers, _NOTES_HEADERS)

    rows: list[ExcelImportRow] = []
    errors: list[ImportErrorEntry] = []

    for offset, cells in enumerate(row_iter):
        excel_row = offset + 2  # 1-based row number (header is row 1)
        smiles = _cell_str(cells[smiles_col] if smiles_col < len(cells) else None)
        if not smiles:
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

        try:
            props = canonicalize_smiles(smiles)
            rows.append(ExcelImportRow(props=props, name=name, notes=notes))
        except RDKitError as e:
            errors.append(ImportErrorEntry(index=excel_row, reason=str(e)))

    workbook.close()

    if not rows and not errors:
        raise RDKitError("No data rows with SMILES found")

    return rows, errors
