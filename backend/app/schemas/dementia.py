from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.core.dementia_enums import (
    DementiaDomain,
    DementiaChangeType,
    FluctuationPattern,
    SafetySignificance,
    CaregiverLanguageCategory,
    DementiaBaselineType,
)


class DementiaBaselineCreate(BaseModel):
    person_id: str
    baseline_type: DementiaBaselineType
    domain: DementiaDomain
    description: str
    severity: Optional[str] = None
    frequency: Optional[str] = None
    context: Optional[str] = None
    established_date: datetime
    last_confirmed_date: Optional[datetime] = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    evidence_ids: List[str] = []
    caregiver_reports: List[Dict[str, Any]] = []


class DementiaBaselineUpdate(BaseModel):
    description: Optional[str] = None
    severity: Optional[str] = None
    frequency: Optional[str] = None
    context: Optional[str] = None
    last_confirmed_date: Optional[datetime] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    evidence_ids: Optional[List[str]] = None
    caregiver_reports: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None


class DementiaBaselineResponse(BaseModel):
    id: str
    person_id: str
    baseline_type: DementiaBaselineType
    domain: DementiaDomain
    description: str
    severity: Optional[str] = None
    frequency: Optional[str] = None
    context: Optional[str] = None
    established_date: datetime
    last_confirmed_date: Optional[datetime] = None
    confidence: float
    evidence_ids: List[str] = []
    caregiver_reports: List[Dict[str, Any]] = []
    is_active: bool
    superseded_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaObservationCreate(BaseModel):
    person_id: str
    domain: DementiaDomain
    change_type: DementiaChangeType
    observation_text: str
    structured_summary: Optional[str] = None
    caregiver_id: Optional[str] = None
    caregiver_language: Optional[str] = None
    caregiver_language_category: Optional[CaregiverLanguageCategory] = None
    occurred_at: datetime
    observation_window_start: Optional[datetime] = None
    observation_window_end: Optional[datetime] = None
    fluctuation_pattern: Optional[FluctuationPattern] = None
    time_of_day: Optional[str] = None
    evidence_ids: List[str] = []


class DementiaObservationResponse(BaseModel):
    id: str
    person_id: str
    domain: DementiaDomain
    change_type: DementiaChangeType
    observation_text: str
    structured_summary: Optional[str] = None
    caregiver_id: Optional[str] = None
    caregiver_language: Optional[str] = None
    caregiver_language_category: Optional[CaregiverLanguageCategory] = None
    occurred_at: datetime
    observation_window_start: Optional[datetime] = None
    observation_window_end: Optional[datetime] = None
    fluctuation_pattern: Optional[FluctuationPattern] = None
    time_of_day: Optional[str] = None
    compared_to_baseline: bool
    baseline_id: Optional[str] = None
    deviation_description: Optional[str] = None
    safety_significance: Optional[SafetySignificance] = None
    safety_concerns: List[str] = []
    possible_contributors: List[str] = []
    uncertainty_notes: Optional[str] = None
    evidence_ids: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaChangeAssessmentCreate(BaseModel):
    person_id: str
    observation_id: str
    baseline_id: Optional[str] = None


class DementiaChangeAssessmentResponse(BaseModel):
    id: str
    person_id: str
    observation_id: str
    baseline_id: Optional[str] = None
    is_new_change: bool
    change_classification: str
    acute_vs_gradual: Optional[str] = None
    progression_vs_episode: Optional[str] = None
    recurrence_assessment: Optional[str] = None
    cognitive_domain_specific: bool
    functional_domain_specific: bool
    behavioral_domain_specific: bool
    domain_identified: Optional[DementiaDomain] = None
    safety_significance: Optional[SafetySignificance] = None
    safety_implications: List[str] = []
    possible_contributing_factors: List[str] = []
    uncertainty: Optional[str] = None
    next_appropriate_action: Optional[str] = None
    dementia_as_explanation_flag: bool
    baseline_erasure_flag: bool
    assessed_at: datetime
    assessed_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaCaregiverDisagreementCreate(BaseModel):
    person_id: str
    caregiver_a_id: str
    caregiver_b_id: str
    observation_domain: DementiaDomain
    caregiver_a_observation: str
    caregiver_b_observation: str
    baseline_comparison_a: Optional[str] = None
    baseline_comparison_b: Optional[str] = None


class DementiaCaregiverDisagreementResponse(BaseModel):
    id: str
    person_id: str
    caregiver_a_id: str
    caregiver_b_id: str
    observation_domain: DementiaDomain
    caregiver_a_observation: str
    caregiver_b_observation: str
    baseline_comparison_a: Optional[str] = None
    baseline_comparison_b: Optional[str] = None
    resolution_status: str
    concrete_examples_requested: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaReasoningRequest(BaseModel):
    person_id: str
    observation_text: str
    domain: Optional[DementiaDomain] = None
    caregiver_id: Optional[str] = None
    occurred_at: Optional[datetime] = None
    evidence_ids: List[str] = []


class DementiaReasoningResponse(BaseModel):
    observation: DementiaObservationResponse
    assessment: DementiaChangeAssessmentResponse
    baseline_used: Optional[DementiaBaselineResponse] = None
    matched_baselines: List[DementiaBaselineResponse] = []
    caregiver_language_analysis: Optional[Dict[str, Any]] = None
    safety_events: List[Dict[str, Any]] = []
    reasoning_trace: Optional[Dict[str, Any]] = None
    counterfactuals: Optional[List[Dict[str, Any]]] = None
    recent_observations: List[Dict[str, Any]] = []
    multi_observation_insight: Optional[Dict[str, Any]] = None


class DementiaCareActionCreate(BaseModel):
    action_type: str
    description: str
    target_domain: Optional[DementiaDomain] = None
    evidence_required: bool = True
    timeframe: Optional[str] = None
    priority_level: str = "moderate"


class DementiaCarePlanCreate(BaseModel):
    person_id: str
    title: str
    description: Optional[str] = None
    priority_level: str = "moderate"
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    related_observations: List[str] = []
    related_safety_events: List[str] = []
    actions: List[DementiaCareActionCreate] = []


class DementiaCarePlanResponse(BaseModel):
    id: str
    person_id: str
    title: str
    description: Optional[str] = None
    priority_level: str
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    actions: List[Dict[str, Any]] = []
    related_observations: List[str] = []
    related_safety_events: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaCaregiverOnboardingCreate(BaseModel):
    person_id: str
    caregiver_id: Optional[str] = None
    baseline_questions: List[str] = []
    daily_checkin_questions: List[str] = []
    safety_monitor_items: List[str] = []
    emergency_contacts: List[Dict[str, Any]] = []


class DementiaCaregiverOnboardingResponse(BaseModel):
    id: str
    person_id: str
    caregiver_id: Optional[str] = None
    status: str
    baseline_questions: List[str] = []
    baseline_progress: Dict[str, Any] = {}
    daily_checkin_questions: List[str] = []
    safety_monitor_items: List[str] = []
    emergency_contacts: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DementiaBaselineComparisonRequest(BaseModel):
    person_id: str
    domain: DementiaDomain
    current_observation: str
    caregiver_id: Optional[str] = None


class DementiaBaselineComparisonResponse(BaseModel):
    is_consistent_with_baseline: bool
    deviation_description: Optional[str] = None
    baseline: Optional[DementiaBaselineResponse] = None
    change_type: DementiaChangeType
    safety_significance: Optional[SafetySignificance] = None
    uncertainty: Optional[str] = None
    next_action: Optional[str] = None


class DementiaCaregiverLanguageAnalysis(BaseModel):
    original_text: str
    detected_categories: List[CaregiverLanguageCategory]
    structured_observation: str
    requires_concrete_evidence: bool
    baseline_status: str
    clinical_label_warning: Optional[str] = None


class DementiaSafetyEventCreate(BaseModel):
    person_id: str
    observation_id: Optional[str] = None
    event_type: str
    description: str
    safety_significance: SafetySignificance
    immediate_action_required: bool = False
    recommended_actions: List[str] = []
    wandering_risk: bool = False
    medication_safety_risk: bool = False
    fall_risk: bool = False
    appliance_safety_risk: bool = False
    driving_safety_risk: bool = False


class DementiaSafetyEventResponse(BaseModel):
    id: str
    person_id: str
    observation_id: Optional[str] = None
    event_type: str
    description: str
    safety_significance: SafetySignificance
    immediate_action_required: bool
    recommended_actions: List[str] = []
    wandering_risk: bool
    medication_safety_risk: bool
    fall_risk: bool
    appliance_safety_risk: bool
    driving_safety_risk: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DementiaReasoningSummary(BaseModel):
    person_id: str
    active_baselines_count: int
    recent_observations_count: int
    new_changes_detected: int
    fluctuations_detected: int
    progressions_detected: int
    safety_events_count: int
    caregiver_disagreements_count: int
    last_assessed_at: Optional[datetime] = None


class DementiaDocumentAnalysisResponse(BaseModel):
    document_type: str
    visit_date: Optional[datetime] = None
    scores: Dict[str, Any] = {}
    structured_observations: List[Dict[str, Any]] = []
    clinical_patterns: List[Dict[str, Any]] = []
    timeline_event_id: Optional[str] = None
    observations_created: int = 0


class DementiaTimelineEventResponse(BaseModel):
    id: str
    person_id: str
    event_type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    significance: Optional[str] = None
    related_observation_id: Optional[str] = None
    related_document_id: Optional[str] = None
    metadata_: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DementiaTimelineAnalysisResponse(BaseModel):
    person_id: str
    period_days: int
    timeline_events: List[Dict[str, Any]] = []
    domain_trends: Dict[str, List[Dict[str, Any]]] = {}
    baselines: List[Dict[str, Any]] = []
    acceleration_detected: Optional[Dict[str, Any]] = None
    total_observations: int
    total_events: int


class DementiaDocumentUploadRequest(BaseModel):
    person_id: str
    document_type: str = "clinical_note"
    visit_date: Optional[datetime] = None
    title: Optional[str] = None
    text: str = ""