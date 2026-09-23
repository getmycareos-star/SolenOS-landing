from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.core.prioritization_enums import (
    PriorityLevel,
    PriorityDimension,
    PriorityReasonCategory,
    TrajectoryType,
    UncertaintyFactor,
    ContradictionType,
    VulnerabilityFactor,
    ActionabilityFactor,
)


class PrioritizationDimensionBase(BaseModel):
    dimension: PriorityDimension
    score: Optional[float] = Field(None, ge=0.0, le=1.0)
    label: Optional[str] = None
    evidence_ids: Optional[List[str]] = None
    explanation: Optional[str] = None


class PrioritizationDimension(PrioritizationDimensionBase):
    id: str
    prioritization_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class PrioritizationBase(BaseModel):
    person_id: str
    subject_type: str
    subject_id: str
    priority_level: PriorityLevel = PriorityLevel.INSUFFICIENT_EVIDENCE
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    change_ids: List[str]
    evidence_ids: List[str]
    baseline_reference: Optional[str] = None
    trajectory: Optional[TrajectoryType] = None
    persistence_days: Optional[int] = None
    is_persistent: Optional[bool] = None
    is_recurrent: Optional[bool] = None
    recurrence_count: Optional[int] = None
    dimensions: List[PrioritizationDimensionBase] = Field(default_factory=list)
    possible_context: Optional[List[str]] = None
    uncertainty_factors: Optional[List[UncertaintyFactor]] = None
    contradiction_types: Optional[List[ContradictionType]] = None
    vulnerability_factors: Optional[List[VulnerabilityFactor]] = None
    actionability_factors: Optional[List[ActionabilityFactor]] = None
    caregiver_concern_expressed: bool = False
    caregiver_concern_evidence_ids: Optional[List[str]] = None
    primary_reason_category: Optional[PriorityReasonCategory] = None
    reason_categories: List[PriorityReasonCategory] = []
    explanation: Optional[str] = None
    attribution: Optional[List[str]] = None
    temporal_scope: Optional[Dict[str, Any]] = None
    comparison_baseline_quality: Optional[str] = None


class PrioritizationCreate(PrioritizationBase):
    pass


class Prioritization(PrioritizationBase):
    id: str
    dimensions: List[PrioritizationDimensionBase] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None
    superseded_by_prioritization_id: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class PrioritizationRankingBase(BaseModel):
    person_id: str
    prioritization_id: str
    rank: int
    reason: Optional[str] = None


class PrioritizationRanking(PrioritizationRankingBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class PrioritizationResponse(BaseModel):
    ok: bool
    person_id: str
    prioritizations: List[Prioritization]
    rankings: List[PrioritizationRanking]
    message: str
    warnings: Optional[List[str]] = None


class PrioritizationSummary(BaseModel):
    person_id: str
    total_prioritizations: int
    critical_count: int
    high_count: int
    moderate_count: int
    low_count: int
    insufficient_evidence_count: int
    no_active_priority_count: int
    top_priority: Optional[Prioritization] = None
    generated_at: datetime