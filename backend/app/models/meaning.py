"""Pydantic models for the Meaning/Contextual Understanding Engine."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.meaning_enums import (
    CausalityStatus,
    ConfidenceType,
    ContradictionType,
    EpistemicLevel,
    GapType,
    PriorityLevel,
    SignificanceLevel,
)


class Person(BaseModel):
    """A care recipient — no hard-coded names."""

    id: str
    name: str
    date_of_birth: str | None = None
    conditions: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Caregiver(BaseModel):
    """A caregiver — no hard-coded names."""

    id: str
    name: str
    email: str | None = None
    relationship: str | None = None
    person_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Evidence(BaseModel):
    """Raw evidence — no hard-coded values."""

    id: str
    person_id: str
    type: str
    source_text: str
    uploaded_by_caregiver_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, str] = Field(default_factory=dict)


class CareEvent(BaseModel):
    """A care event linked to evidence."""

    id: str
    person_id: str
    description: str
    created_by_caregiver_id: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str = "observation"


class Baseline(BaseModel):
    """Baseline measurement for comparison."""

    id: str
    person_id: str
    measurement_type: str
    value: float
    unit: str
    source_evidence_id: str | None = None
    established_at: datetime = Field(default_factory=datetime.utcnow)


class Change(BaseModel):
    """A detected change from baseline."""

    id: str
    person_id: str
    baseline_id: str | None = None
    measurement_type: str
    change_type: str
    previous_value: float | None = None
    current_value: float | None = None
    unit: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    detected_at: datetime = Field(default_factory=datetime.utcnow)


class Contradiction(BaseModel):
    """A contradiction between evidence sources."""

    id: str
    person_id: str
    contradiction_type: ContradictionType
    description: str
    evidence_ids: list[str] = Field(default_factory=list)
    detected_at: datetime = Field(default_factory=datetime.utcnow)


class InformationGap(BaseModel):
    """An identified information gap."""

    id: str
    person_id: str
    gap_type: GapType
    description: str
    severity: str = "moderate"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OpenQuestion(BaseModel):
    """An open question requiring clarification."""

    id: str
    person_id: str
    question: str
    context: str = ""
    priority: PriorityLevel = PriorityLevel.ROUTINE
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CausalHypothesis(BaseModel):
    """A causal hypothesis — never asserted as fact."""

    id: str
    person_id: str
    hypothesis: str
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    contradicting_evidence_ids: list[str] = Field(default_factory=list)
    causality_status: CausalityStatus = CausalityStatus.CAUSALITY_NOT_ESTABLISHED
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SignificanceAssessment(BaseModel):
    """Significance assessment of a change."""

    id: str
    person_id: str
    change_id: str | None = None
    significance_level: SignificanceLevel
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    rationale: str = ""
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeaningOutput(BaseModel):
    """The structured meaning output."""

    id: str
    person_id: str
    what_is_happening: str
    epistemic_level: EpistemicLevel
    rationale: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_type: ConfidenceType = ConfidenceType.MEANING_CONFIDENCE
    evidence_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    changes: list[Change] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)
    information_gaps: list[InformationGap] = Field(default_factory=list)
    open_questions: list[OpenQuestion] = Field(default_factory=list)
    causal_hypotheses: list[CausalHypothesis] = Field(default_factory=list)
    caregiver_attribution: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PriorityAssessment(BaseModel):
    """Priority assessment for a meaning output."""

    id: str
    person_id: str
    meaning_id: str
    priority_level: PriorityLevel
    rationale: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
