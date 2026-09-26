"""API schemas for the Action Intelligence Engine."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.core.action_enums import (
    ActionOwnership,
    ActionPriority,
    ActionStatus,
    ActionType,
    ConfidenceType,
    SafetyClassification,
    TemporalScope,
)
from app.core.meaning_enums import PriorityLevel, SignificanceLevel
from app.models.meaning import (
    Change,
    ClinicianInstruction,
    Contradiction,
    CareAppointment,
    Evidence,
    InformationGap,
    MeaningOutput,
    OpenQuestion,
    PriorityAssessment,
    SignificanceAssessment,
)


class ActionDependencySchema(BaseModel):
    id: str
    action_id: str
    description: str
    depends_on: str
    resolution: str | None = None
    resolved: bool = False
    resolved_at: datetime | None = None


class ActionSchema(BaseModel):
    id: str
    person_id: str
    action_type: ActionType
    title: str
    description: str
    reason: str
    change_ids: list[str] = Field(default_factory=list)
    meaning_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    priority_id: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_type: ConfidenceType = ConfidenceType.ACTION_CONFIDENCE
    uncertainty: str | None = None
    attribution: str
    attribution_details: dict[str, str] = Field(default_factory=dict)
    safety_classification: SafetyClassification = SafetyClassification.ROUTINE
    safety_basis: str | None = None
    owner: ActionOwnership = ActionOwnership.UNKNOWN
    temporal_scope: TemporalScope = TemporalScope.UNCERTAIN_TIMING
    specific_timing: str | None = None
    priority: ActionPriority = ActionPriority.ROUTINE
    priority_rationale: str | None = None
    dependencies: list[ActionDependencySchema] = Field(default_factory=list)
    status: ActionStatus = ActionStatus.RECOMMENDED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: datetime | None = None
    completed_at: datetime | None = None
    superseded_by: str | None = None
    superseded_at: datetime | None = None
    superseded_reason: str | None = None
    is_clinician_instruction: bool = False
    clinician_instruction_source: str | None = None
    clinician_instruction_date: datetime | None = None
    clinician_instruction_scope: str | None = None
    what: str | None = None
    why: str | None = None
    based_on: str | None = None
    who: str | None = None
    when: str | None = None
    what_we_dont_know: str | None = None
    what_solenos_is_not_concluding: str | None = None


class ActionSetSchema(BaseModel):
    id: str
    person_id: str
    meaning_id: str
    actions: list[ActionSchema] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    source_reasoning: str = ""
    ask_count: int = 0
    check_count: int = 0
    monitor_count: int = 0
    do_count: int = 0
    prepare_count: int = 0
    document_count: int = 0
    professional_input_count: int = 0
    escalation_count: int = 0
    highest_priority: ActionPriority = ActionPriority.LOW
    highest_safety: SafetyClassification = SafetyClassification.ROUTINE
    has_insufficient_evidence: bool = False


class ActionHistoryEntrySchema(BaseModel):
    id: str
    action_id: str
    person_id: str
    change_type: str
    previous_state: dict | None = None
    new_state: dict | None = None
    reason: str | None = None
    triggered_by: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Request/Response schemas
class ActionGenerateRequest(BaseModel):
    person_id: str
    meaning_id: str | None = None
    change_ids: list[str] = Field(default_factory=list)
    priority_ids: list[str] = Field(default_factory=list)
    changes: list[dict] = Field(default_factory=list)
    evidence: list[dict] = Field(default_factory=list)
    contradictions: list[dict] = Field(default_factory=list)
    information_gaps: list[dict] = Field(default_factory=list)
    open_questions: list[dict] = Field(default_factory=list)
    significance_assessments: list[dict] = Field(default_factory=list)
    priorities: list[dict] = Field(default_factory=list)
    clinician_instructions: list[dict] = Field(default_factory=list)
    upcoming_appointments: list[dict] = Field(default_factory=list)
    meaning: dict | None = None  # Full MeaningOutput as dict


class ActionGenerateResponse(BaseModel):
    action_set_id: str
    person_id: str
    actions: list[ActionSchema]
    generated_at: datetime


class ActionListResponse(BaseModel):
    person_id: str
    count: int
    items: list[ActionSchema]


class ClinicianInstructionSchema(BaseModel):
    id: str
    person_id: str
    author: str
    author_role: str
    instruction_text: str
    scope: str
    date_issued: datetime
    expiration: datetime | None = None
    is_active: bool = True
    evidence_ids: list[str] = Field(default_factory=list)
    change_ids: list[str] = Field(default_factory=list)


class CareAppointmentSchema(BaseModel):
    id: str
    person_id: str
    title: str
    scheduled_at: datetime
    location: str | None = None
    with_clinician: str | None = None
    with_role: str | None = None
    confirmed: bool = True
    evidence_ids: list[str] = Field(default_factory=list)


class ActionUpdateRequest(BaseModel):
    action_id: str
    status: ActionStatus
    acknowledged_by: str | None = None
    completion_notes: str | None = None


class ActionHistoryResponse(BaseModel):
    action_id: str
    count: int
    items: list[ActionHistoryEntrySchema]


class ActionSupersedeRequest(BaseModel):
    action_id: str
    superseded_by_id: str
    reason: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None