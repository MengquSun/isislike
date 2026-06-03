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


class SaveMoleculeRequest(BaseModel):
    smiles: str


class SimilaritySearchRequest(BaseModel):
    smiles: str
    match_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    match_count: int = Field(default=50, ge=1, le=500)
