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


# --- Phase 2A: dynamic fields ---

FIELD_TYPES_MVP = frozenset({"text", "number", "date", "select"})


class DatabaseCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str | None = None


class DatabaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None


class DatabaseResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: str | None = None


class FieldDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1)
    field_type: str = Field(..., min_length=1)
    options: dict | None = None
    sort_order: int = 0


class FieldDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    field_type: str | None = None
    options: dict | None = None
    sort_order: int | None = None


class FieldDefinitionResponse(BaseModel):
    id: str
    database_id: str
    name: str
    field_type: str
    options: dict | None = None
    sort_order: int
    created_at: str | None = None


class RecordValueResponse(BaseModel):
    field_id: str
    field_name: str | None = None
    field_type: str | None = None
    text_value: str | None = None
    number_value: float | None = None
    date_value: str | None = None


class RecordCreate(BaseModel):
    molecule_id: str | None = None
    values: dict[str, str | int | float | None] = Field(
        default_factory=dict,
        description="Map of field_definition id -> value",
    )


class RecordUpdate(BaseModel):
    molecule_id: str | None = None
    values: dict[str, str | int | float | None] | None = None


class RecordResponse(BaseModel):
    id: str
    database_id: str
    molecule_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    values: list[RecordValueResponse] = Field(default_factory=list)
