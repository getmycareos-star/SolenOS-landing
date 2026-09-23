from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from app.core.meaning_enums import (
    EpistemicLevel,
    TemporalScopeClassification,
    LongitudinalPatternCategory,
    BaselineRelationship,
    EvidenceRelationship,
    CausalStatus,
    MeaningConfidenceType,
    ContextFactorType,
    CaregiverPerspective,
)


class ContextFactor(BaseModel):
    factor_type: ContextFactorType
    description: str
    evidence_ids: Optional[List[str]] = None
    attribution: Optional[List[str]] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    epistemic_level: EpistemicLevel

    class Config:
        from_attributes = True


class MeaningEvidenceLink(BaseModel):
    evidence_id: str
    relationship: EvidenceRelationship
    epistemic_level: EpistemicLevel
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    attribution: Optional[List[str]] = None

    class Config:
        from_attributes = True


class MeaningChangeLink(BaseModel):
    change_id: str
    relationship: str
    evidence_ids: Optional[List[str]] = None
    attribution: Optional[List[str]] = None

    class Config:
        from_attributes = True


class AlternativeInterpretation(BaseModel):
    description: str
    supporting_evidence_ids: Optional[List[str]] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    attribution: Optional[List[str]] = None

    class Config:
        from_attributes = True


class MeaningBase(BaseModel):
    person_id: str
    change_id: Optional[str] = None
    priority_id: Optional[str] = None
    context_factors: Optional[List[ContextFactor]] = None
    baseline_relationship: Optional[BaselineRelationship] = None
    longitudinal_pattern: Optional[LongitudinalPatternCategory] = None
    temporal_scope: Optional[TemporalScopeClassification] = None
    evidence_relationship: Optional[EvidenceRelationship] = None
    causal_status: Optional[CausalStatus] = None
    confidence_type: MeaningConfidenceType = MeaningConfidenceType.MEANING_CONFIDENCE
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    supporting_state_elements: Optional[List[Dict[str, Any]]] = None
    evidence_ids: Optional[List[str]] = None
    uncertainty_ids: Optional[List[str]] = None
    contradiction_ids: Optional[List[str]] = None
    alternative_interpretations: Optional[List[AlternativeInterpretation]] = None
    not_established: Optional[List[Dict[str, Any]]] = None
    caregiver_perspective: Optional[CaregiverPerspective] = None
    attribution: Optional[List[str]] = None
    rationale: Optional[str] = None


class Meaning(MeaningBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeaningResponse(BaseModel):
    ok: bool
    person_id: str
    meanings: List[Meaning]
    message: str
    warnings: Optional[List[str]] = None
