"""Pydantic models for the Action Intelligence Engine.

Models represent grounded next steps derived from structured reasoning state.
Every action must have traceability to evidence, change, meaning, and priority.
"""

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
from app.models.meaning import Change, MeaningOutput


class ActionDependency(BaseModel):
    """A dependency that must be resolved before an action can be completed."""

    id: str
    action_id: str
    description: str
    depends_on: str  # What this action depends on (e.g., "access to medication record")
    resolution: str | None = None  # How to resolve if unmet
    resolved: bool = False
    resolved_at: datetime | None = None


class ActionEvidence(BaseModel):
    """Evidence reference for an action."""

    evidence_id: str
    evidence_type: str
    role: str  # "supporting" | "contradicting" | "contextual"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Action(BaseModel):
    """A grounded next step with full traceability.

    Every action must answer: Why did SolenOS recommend this?
    """

    id: str
    person_id: str
    action_type: ActionType
    title: str
    description: str
    reason: str  # Why this action follows from the current situation

    # Traceability — non-negotiable
    change_ids: list[str] = Field(default_factory=list)
    meaning_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    priority_id: str | None = None

    # Confidence and uncertainty — separate dimensions
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_type: ConfidenceType = ConfidenceType.ACTION_CONFIDENCE
    uncertainty: str | None = None  # What remains unknown

    # Attribution — critical distinction
    attribution: str  # "caregiver_A" | "clinician_instruction" | "SolenOS_reasoning"
    attribution_details: dict[str, str] = Field(default_factory=dict)

    # Safety and scope
    safety_classification: SafetyClassification = SafetyClassification.ROUTINE
    safety_basis: str | None = None  # Why this safety classification

    # Ownership and timing
    owner: ActionOwnership = ActionOwnership.UNKNOWN
    temporal_scope: TemporalScope = TemporalScope.UNCERTAIN_TIMING
    specific_timing: str | None = None  # e.g., "2026-01-15", "next visit"

    # Priority
    priority: ActionPriority = ActionPriority.ROUTINE
    priority_rationale: str | None = None

    # Dependencies
    dependencies: list[ActionDependency] = Field(default_factory=list)

    # Status tracking
    status: ActionStatus = ActionStatus.RECOMMENDED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: datetime | None = None
    completed_at: datetime | None = None
    superseded_by: str | None = None
    superseded_at: datetime | None = None
    superseded_reason: str | None = None

    # Source distinction
    is_clinician_instruction: bool = False
    clinician_instruction_source: str | None = None
    clinician_instruction_date: datetime | None = None
    clinician_instruction_scope: str | None = None

    # Explanation fields for frontend
    what: str | None = None  # What to ask/check/monitor/do
    why: str | None = None  # Why this follows from the situation
    based_on: str | None = None  # Evidence/change/meaning summary
    who: str | None = None  # Who should perform the action
    when: str | None = None  # When it is relevant
    what_we_dont_know: str | None = None  # Uncertainty
    what_solenos_is_not_concluding: str | None = None  # Non-diagnosis, non-causal


class ActionSet(BaseModel):
    """A set of actions for a person, derived from meaning output."""

    id: str
    person_id: str
    meaning_id: str
    actions: list[Action] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    source_reasoning: str = ""  # Summary of the reasoning chain

    # Summary counts by type
    ask_count: int = 0
    check_count: int = 0
    monitor_count: int = 0
    do_count: int = 0
    prepare_count: int = 0
    document_count: int = 0
    professional_input_count: int = 0
    escalation_count: int = 0
    rejected_action_count: int = 0

    # Overall assessment
    highest_priority: ActionPriority = ActionPriority.LOW
    highest_safety: SafetyClassification = SafetyClassification.ROUTINE
    has_insufficient_evidence: bool = False

    def model_post_init(self, __context) -> None:
        """Recalculate counts after model initialization."""
        self._recalculate_counts()

    def _recalculate_counts(self) -> None:
        """Recalculate summary counts from actions."""
        self.ask_count = sum(1 for a in self.actions if a.action_type == ActionType.ASK)
        self.check_count = sum(1 for a in self.actions if a.action_type == ActionType.CHECK)
        self.monitor_count = sum(1 for a in self.actions if a.action_type == ActionType.MONITOR)
        self.do_count = sum(1 for a in self.actions if a.action_type == ActionType.DO)
        self.prepare_count = sum(1 for a in self.actions if a.action_type == ActionType.PREPARE)
        self.document_count = sum(1 for a in self.actions if a.action_type == ActionType.DOCUMENT)
        self.professional_input_count = sum(
            1 for a in self.actions if a.action_type == ActionType.PROFESSIONAL_INPUT
        )
        self.escalation_count = sum(
            1 for a in self.actions if a.action_type == ActionType.ESCALATION
        )

        if self.actions:
            priority_order = {
                ActionPriority.IMMEDIATE: 5,
                ActionPriority.URGENT: 4,
                ActionPriority.ROUTINE: 3,
                ActionPriority.LOW: 2,
                ActionPriority.DEFERRED: 1,
            }
            self.highest_priority = max(
                self.actions, key=lambda a: priority_order.get(a.priority, 0)
            ).priority

            safety_order = {
                SafetyClassification.POTENTIAL_URGENT_CONCERN: 5,
                SafetyClassification.PROMPT_PROFESSIONAL_REVIEW: 4,
                SafetyClassification.ATTENTION_WORTHY: 3,
                SafetyClassification.ROUTINE: 2,
                SafetyClassification.INSUFFICIENT_EVIDENCE: 1,
            }
            self.highest_safety = max(
                self.actions, key=lambda a: safety_order.get(a.safety_classification, 0)
            ).safety_classification

            self.has_insufficient_evidence = any(
                a.safety_classification == SafetyClassification.INSUFFICIENT_EVIDENCE
                for a in self.actions
            )


class ActionHistoryEntry(BaseModel):
    """History entry for an action's lifecycle."""

    id: str
    action_id: str
    person_id: str
    change_type: str  # "created" | "acknowledged" | "completed" | "superseded" | "revised"
    previous_state: dict | None = None
    new_state: dict | None = None
    reason: str | None = None
    triggered_by: str | None = None  # "new_evidence" | "caregiver" | "system" | "clinician"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ActionGenerateRequest(BaseModel):
    """Request to generate actions."""

    person_id: str
    meaning_id: str | None = None
    change_ids: list[str] = Field(default_factory=list)
    priority_ids: list[str] = Field(default_factory=list)


class ActionGenerateResponse(BaseModel):
    """Response containing generated actions."""

    action_set_id: str
    person_id: str
    actions: list[Action]
    generated_at: datetime


class ActionListResponse(BaseModel):
    """Response for listing actions."""

    person_id: str
    count: int
    items: list[Action]


class ActionUpdateRequest(BaseModel):
    """Request to update an action's status."""

    action_id: str
    status: ActionStatus
    acknowledged_by: str | None = None
    completion_notes: str | None = None


class ActionHistoryResponse(BaseModel):
    """Response for action history."""

    action_id: str
    count: int
    items: list[ActionHistoryEntry]