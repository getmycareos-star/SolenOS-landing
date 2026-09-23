from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from app.core.safety_enums import (
    SafetyDecision,
    RiskClass,
    ClaimType,
    ClaimStrength,
    EscalationDestination,
    EscalationStatus,
    SourceAuthority,
    SourceQuality,
    CurrentnessStatus,
    SafetyInvariantViolation,
    SafetyState,
    SafetyEventType,
)


class EvidenceReference(BaseModel):
    evidence_id: str
    source_text: str
    source_span: Optional[str] = None
    source_span_start: Optional[int] = None
    source_span_end: Optional[int] = None
    authority: SourceAuthority
    quality: SourceQuality
    currentness: CurrentnessStatus
    document_time: Optional[datetime] = None
    uploaded_at: Optional[datetime] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    supports_claim: bool = True
    contradicts_claim: bool = False
    notes: Optional[str] = None


class ClaimVerification(BaseModel):
    claim_text: str
    claim_type: ClaimType
    claim_strength: ClaimStrength
    evidence_references: List[EvidenceReference] = []
    contradictions: List[EvidenceReference] = []
    confidence: float = Field(ge=0.0, le=1.0)
    epistemic_state: str
    is_supported: bool
    strength_mismatch: bool = False
    citation_mismatch: bool = False
    verification_notes: Optional[str] = None
    timestamp: Optional[datetime] = None


class SafetyQualification(BaseModel):
    qualification_type: str
    description: str
    severity: str = "moderate"
    required_wording: Optional[str] = None
    blocking: bool = False


class SafetyDecisionObject(BaseModel):
    decision: SafetyDecision
    safety_state: SafetyState
    risk_class: RiskClass
    claim_verifications: List[ClaimVerification] = []
    qualifications: List[SafetyQualification] = []
    violations: List[SafetyInvariantViolation] = []
    escalation_required: bool = False
    escalation_destination: Optional[EscalationDestination] = None
    escalation_reason: Optional[str] = None
    human_review_required: bool = False
    rationale: str
    policy_references: List[str] = []
    timestamp: Optional[datetime] = None
    safety_version: str = "1.0"


class EscalationObject(BaseModel):
    id: str
    person_id: str
    trigger: str
    risk_category: RiskClass
    affected_person_id: str
    evidence_ids: List[str] = []
    uncertainty: Optional[str] = None
    recommended_reviewer: EscalationDestination
    urgency: str = "routine"
    status: EscalationStatus = EscalationStatus.DETECTED
    decision: Optional[str] = None
    reviewer_identity: Optional[str] = None
    resolution: Optional[str] = None
    timestamp: datetime
    resolved_at: Optional[datetime] = None
    provenance: Optional[str] = None


class SafetyEvent(BaseModel):
    id: str
    event_type: SafetyEventType
    person_id: str
    subject_type: str
    subject_id: str
    description: str
    safety_decision: Optional[SafetyDecisionObject] = None
    escalation_id: Optional[str] = None
    violations: List[SafetyInvariantViolation] = []
    policy_references: List[str] = []
    input_claims: List[str] = []
    evidence_ids: List[str] = []
    final_output: Optional[str] = None
    reviewer_id: Optional[str] = None
    override_reason: Optional[str] = None
    timestamp: datetime
    created_by_caregiver_id: Optional[str] = None


class SafetyAuditRecord(BaseModel):
    id: str
    person_id: str
    request_id: str
    user_role: str
    input_text: str
    candidate_claims: List[str] = []
    evidence_ids: List[str] = []
    source_quality: Dict[str, str] = {}
    epistemic_states: Dict[str, str] = {}
    contradictions: List[str] = []
    risk_classification: RiskClass
    safety_decision: SafetyDecision
    safety_state: SafetyState
    qualifications: List[SafetyQualification] = []
    violations: List[SafetyInvariantViolation] = []
    escalation_id: Optional[str] = None
    human_review_required: bool
    rationale: str
    policy_references: List[str] = []
    final_output: Optional[str] = None
    model_version: Optional[str] = None
    safety_version: str = "1.0"
    timestamp: datetime
    reviewer_id: Optional[str] = None
    override_reason: Optional[str] = None


class SafetyEvaluationResult(BaseModel):
    benchmark_name: str
    passed: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    failure_details: List[Dict[str, Any]] = []
    score: float = Field(ge=0.0, le=1.0)
    timestamp: datetime


class SafetyRegressionCheck(BaseModel):
    check_name: str
    previous_score: float
    current_score: float
    threshold: float
    passed: bool
    regression_detected: bool
    details: Optional[str] = None


class SafetyPolicyRule(BaseModel):
    rule_id: str
    rule_name: str
    description: str
    is_deterministic: bool = True
    claim_types: List[ClaimType] = []
    risk_classes: List[RiskClass] = []
    action: SafetyDecision
    conditions: Dict[str, Any] = {}
    priority: int = 100
    is_active: bool = True
    version: str = "1.0"
    created_at: datetime
    updated_at: datetime


class SafetyContractInput(BaseModel):
    user_intent: str
    candidate_claims: List[str] = []
    evidence_references: List[EvidenceReference] = []
    epistemic_status: Dict[str, str] = {}
    source_quality: Dict[str, SourceQuality] = {}
    temporal_validity: Dict[str, str] = {}
    contradictions: List[str] = []
    risk_classification: RiskClass
    proposed_action_level: str
    user_role: str = "caregiver"
    person_id: str
    context: Dict[str, Any] = {}


class SafetyContractOutput(BaseModel):
    decision: SafetyDecision
    safety_state: SafetyState
    qualifications: List[SafetyQualification] = []
    escalation_required: bool
    escalation_destination: Optional[EscalationDestination] = None
    escalation_reason: Optional[str] = None
    human_review_required: bool
    rationale: str
    policy_references: List[str] = []
    violations: List[SafetyInvariantViolation] = []
    modified_output: Optional[str] = None
    timestamp: datetime


class SafetyBenchmarkCase(BaseModel):
    id: str
    benchmark_category: str
    name: str
    description: str
    input_text: str
    expected_decision: SafetyDecision
    expected_risk_class: RiskClass
    expected_violations: List[SafetyInvariantViolation] = []
    expected_qualifications: List[str] = []
    tags: List[str] = []
    is_adversarial: bool = False
    created_at: datetime


class SafetyBlindSpot(BaseModel):
    id: str
    name: str
    description: str
    failure_mechanism: str
    consequence: str
    prevention: str
    detection_method: str
    test_case_id: Optional[str] = None
    is_mitigated: bool = False
    identified_at: datetime
    mitigated_at: Optional[datetime] = None


class SafetyFeedback(BaseModel):
    id: str
    person_id: str
    safety_event_id: str
    feedback_type: str
    feedback_text: str
    reviewer_id: str
    original_decision: SafetyDecision
    override_decision: Optional[SafetyDecision] = None
    is_correct: bool
    lesson_learned: Optional[str] = None
    timestamp: datetime
