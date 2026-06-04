from pydantic import BaseModel, Field


class SmilesInput(BaseModel):
    smiles: str = Field(..., min_length=1, description="Raw SMILES from Ketcher")


class SmartsInput(BaseModel):
    smarts: str = Field(..., min_length=1, description="SMARTS query from Ketcher")


class CanonicalizeResponse(BaseModel):
    canonical_smiles: str
    molecular_weight: float
    molecular_formula: str
    morgan_fingerprint: list[float]


class MoleculeResponse(BaseModel):
    id: str
    canonical_smiles: str
    molecular_weight: float | None = None
    molecular_formula: str | None = None
    similarity: float | None = None
    name: str | None = None
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class MoleculeDetailResponse(MoleculeResponse):
    """Full record for detail drawer; excludes large molfile by default."""

    has_structure_svg: bool = False


class SaveMoleculeRequest(BaseModel):
    smiles: str
    molfile: str | None = None
    name: str | None = None
    notes: str | None = None


class UpdateMoleculeRequest(BaseModel):
    name: str | None = None
    notes: str | None = None


class SimilaritySearchRequest(BaseModel):
    smiles: str
    match_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    match_count: int = Field(default=50, ge=1, le=500)


class ImportErrorItem(BaseModel):
    index: int
    reason: str


class ImportResponse(BaseModel):
    success_count: int
    failed_count: int
    errors: list[ImportErrorItem]
