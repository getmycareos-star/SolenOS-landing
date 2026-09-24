"""API schemas for the Meaning/Contextual Understanding Engine."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.meaning_enums import (
    ConfidenceType,
    EpistemicLevel,
    PriorityLevel,
    SignificanceLevel,
)


class PersonCreate(BaseModel):
    name: str
    date_of_birth: str | None = None
    conditions: list[str] = Field(default_factory=list)


class CaregiverCreate(BaseModel):
    name: str
    email: str | None = None
    relationship: str | None = None


class EvidenceCreate(BaseModel):
    type: str
    source_text: str
    uploaded_by_caregiver_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class CareEventCreate(BaseModel):
    description: str
    created_by_caregiver_id: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    event_type: str = "observation"


class BaselineCreate(BaseModel):
    measurement_type: str
    value: float
    unit: str
    source_evidence_id: str | None = None


class ChangeCreate(BaseModel):
    baseline_id: str | None = None
    measurement_type: str
    change_type: str
    previous_value: float | None = None
    current_value: float | None = None
    unit: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class SignificanceAssessmentCreate(BaseModel):
    change_id: str | None = None
    significance_level: SignificanceLevel
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    rationale: str = ""
    supporting_evidence_ids: list[str] = Field(default_factory=list)


class MeaningGenerateRequest(BaseModel):
    person_id: str
    change_id: str | None = None
    priority_id: str | None = None


class MeaningGenerateFromPriorityRequest(BaseModel):
    person_id: str
    priority_id: str


class MeaningGenerateAllRequest(BaseModel):
    person_id: str


class MeaningResponse(BaseModel):
    id: str
    person_id: str
    what_is_happening: str
    epistemic_level: EpistemicLevel
    rationale: str
    confidence: float
    confidence_type: ConfidenceType
    evidence_confidence: float
    changes: list[dict] = Field(default_factory=list)
    contradictions: list[dict] = Field(default_factory=list)
    information_gaps: list[dict] = Field(default_factory=list)
    open_questions: list[dict] = Field(default_factory=list)
    causal_hypotheses: list[dict] = Field(default_factory=list)
    caregiver_attribution: list[str] = Field(default_factory=list)
    created_at: datetime


class MeaningListResponse(BaseModel):
    person_id: str
    count: int
    items: list[MeaningResponse]


class PriorityAssessmentResponse(BaseModel):
    id: str
    person_id: str
    meaning_id: str
    priority_level: PriorityLevel
    rationale: str
    confidence: float
    created_at: datetime


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
