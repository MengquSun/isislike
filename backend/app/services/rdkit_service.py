"""RDKit cheminformatics — all SMILES/SMARTS processing happens here."""

from __future__ import annotations

from dataclasses import dataclass

from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

FINGERPRINT_RADIUS = 2
FINGERPRINT_BITS = 1024


@dataclass
class MoleculeProperties:
    canonical_smiles: str
    molecular_weight: float
    molecular_formula: str
    morgan_fingerprint: list[float]


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


def canonicalize_smiles(raw_smiles: str) -> MoleculeProperties:
    mol = _mol_from_smiles(raw_smiles)
    Chem.SanitizeMol(mol)
    canonical = Chem.MolToSmiles(mol, canonical=True)
    return _properties_from_mol(mol, canonical)


def properties_from_canonical_smiles(canonical_smiles: str) -> MoleculeProperties:
    mol = _mol_from_smiles(canonical_smiles)
    return _properties_from_mol(mol, Chem.MolToSmiles(mol, canonical=True))


def _properties_from_mol(mol: Chem.Mol, canonical: str) -> MoleculeProperties:
    fp = AllChem.GetMorganFingerprintAsBitVect(
        mol, FINGERPRINT_RADIUS, nBits=FINGERPRINT_BITS
    )
    return MoleculeProperties(
        canonical_smiles=canonical,
        molecular_weight=round(Descriptors.MolWt(mol), 4),
        molecular_formula=rdMolDescriptors.CalcMolFormula(mol),
        morgan_fingerprint=_bitvect_to_vector(fp),
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
