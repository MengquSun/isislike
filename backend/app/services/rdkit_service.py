"""RDKit cheminformatics — all SMILES/SMARTS processing happens here."""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO

from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

FINGERPRINT_RADIUS = 2
FINGERPRINT_BITS = 1024
SVG_WIDTH = 320
SVG_HEIGHT = 240


@dataclass
class MoleculeProperties:
    canonical_smiles: str
    molecular_weight: float
    molecular_formula: str
    morgan_fingerprint: list[float]
    molfile: str | None = None
    structure_svg: str | None = None


@dataclass
class ImportErrorEntry:
    index: int
    reason: str


@dataclass
class ImportResult:
    success_count: int = 0
    failed_count: int = 0
    errors: list[ImportErrorEntry] = field(default_factory=list)


class RDKitError(ValueError):
    pass


def _mol_from_smiles(smiles: str) -> Chem.Mol:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise RDKitError(f"Invalid SMILES: {smiles}")
    return mol


def _mol_from_smarts(smarts: str) -> Chem.Mol:
    mol = Chem.MolFromSmarts(smarts)
    if mol is None:
        raise RDKitError(f"Invalid SMARTS: {smarts}")
    return mol


def _mol_from_molblock(molblock: str) -> Chem.Mol:
    mol = Chem.MolFromMolBlock(molblock, removeHs=False, sanitize=True)
    if mol is None:
        raise RDKitError("Invalid mol block")
    return mol


def mol_to_svg(mol: Chem.Mol, width: int = SVG_WIDTH, height: int = SVG_HEIGHT) -> str:
    AllChem.Compute2DCoords(mol)
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()


def canonicalize_smiles(raw_smiles: str, molfile: str | None = None) -> MoleculeProperties:
    mol = _mol_from_smiles(raw_smiles)
    Chem.SanitizeMol(mol)
    canonical = Chem.MolToSmiles(mol, canonical=True)
    return _properties_from_mol(mol, canonical, molfile=molfile)


def properties_from_canonical_smiles(canonical_smiles: str) -> MoleculeProperties:
    mol = _mol_from_smiles(canonical_smiles)
    return _properties_from_mol(mol, Chem.MolToSmiles(mol, canonical=True))


def properties_from_molblock(molblock: str) -> MoleculeProperties:
    mol = _mol_from_molblock(molblock)
    Chem.SanitizeMol(mol)
    canonical = Chem.MolToSmiles(mol, canonical=True)
    stored_molfile = Chem.MolToMolBlock(mol)
    return _properties_from_mol(mol, canonical, molfile=stored_molfile)


def parse_molfile_bytes(data: bytes) -> MoleculeProperties:
    text = data.decode("utf-8", errors="replace").strip()
    if not text:
        raise RDKitError("Empty mol file")
    return properties_from_molblock(text)


def parse_sdf_bytes(data: bytes) -> tuple[list[MoleculeProperties], list[ImportErrorEntry]]:
    """Parse an SDF file; returns successful properties and per-record errors."""
    props_list: list[MoleculeProperties] = []
    errors: list[ImportErrorEntry] = []

    supplier = Chem.ForwardSDMolSupplier(BytesIO(data), removeHs=False, sanitize=True)
    for idx, mol in enumerate(supplier):
        if mol is None:
            errors.append(
                ImportErrorEntry(index=idx, reason="Invalid mol block")
            )
            continue
        try:
            Chem.SanitizeMol(mol)
            canonical = Chem.MolToSmiles(mol, canonical=True)
            molfile = Chem.MolToMolBlock(mol)
            props_list.append(_properties_from_mol(mol, canonical, molfile=molfile))
        except Exception as e:
            errors.append(ImportErrorEntry(index=idx, reason=str(e)))

    if not props_list and not errors:
        raise RDKitError("Empty or unreadable SDF file")

    return props_list, errors


def _properties_from_mol(
    mol: Chem.Mol,
    canonical: str,
    *,
    molfile: str | None = None,
) -> MoleculeProperties:
    fp = AllChem.GetMorganFingerprintAsBitVect(
        mol, FINGERPRINT_RADIUS, nBits=FINGERPRINT_BITS
    )
    return MoleculeProperties(
        canonical_smiles=canonical,
        molecular_weight=round(Descriptors.MolWt(mol), 4),
        molecular_formula=rdMolDescriptors.CalcMolFormula(mol),
        morgan_fingerprint=_bitvect_to_vector(fp),
        molfile=molfile,
        structure_svg=mol_to_svg(mol),
    )


def _bitvect_to_vector(fp) -> list[float]:
    return [float(fp.GetBit(i)) for i in range(FINGERPRINT_BITS)]


def validate_smarts(smarts: str) -> None:
    _mol_from_smarts(smarts)


def has_substructure_match(target_smiles: str, query_smarts: str) -> bool:
    target = _mol_from_smiles(target_smiles)
    query = _mol_from_smarts(query_smarts)
    return target.HasSubstructMatch(query)


def tanimoto_similarity(fp_a: list[float], fp_b: list[float]) -> float:
    if len(fp_a) != len(fp_b):
        raise RDKitError("Fingerprint length mismatch")
    a = sum(fp_a)
    b = sum(fp_b)
    if a == 0 and b == 0:
        return 1.0
    intersection = sum(x * y for x, y in zip(fp_a, fp_b))
    union = a + b - intersection
    return intersection / union if union > 0 else 0.0
