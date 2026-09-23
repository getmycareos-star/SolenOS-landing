from enum import Enum


class PriorityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    NO_ACTIVE_PRIORITY = "no_active_priority"


class PriorityDimension(str, Enum):
    SAFETY_SIGNIFICANCE = "safety_significance"
    MAGNITUDE = "magnitude"
    TRAJECTORY = "trajectory"
    PERSISTENCE = "persistence"
    RECURRENCE = "recurrence"
    UNCERTAINTY = "uncertainty"
    CONTRADICTION = "contradiction"
    VULNERABILITY_CONTEXT = "vulnerability_context"
    CAREGIVER_CONCERN = "caregiver_concern"
    ACTIONABILITY = "actionability"


class TrajectoryType(str, Enum):
    ISOLATED = "isolated"
    REPEATED = "repeated"
    WORSENING = "worsening"
    IMPROVING = "improving"
    PERSISTENT_DEVIATION = "persistent_deviation"
    RECURRENCE = "recurrence"
    FLUCTUATION = "fluctuation"
    STABILIZING = "stabilizing"
    RECOVERING = "recovering"
    UNKNOWN = "unknown"


class UncertaintyFactor(str, Enum):
    MEDICATION_ADMINISTRATION_UNCLEAR = "medication_administration_unclear"
    CAREGIVER_ACCOUNTS_CONFLICT = "caregiver_accounts_conflict"
    TIMING_UNCERTAIN = "timing_uncertain"
    BASELINE_POORLY_ESTABLISHED = "baseline_poorly_established"
    MEASUREMENT_CONTEXT_MISSING = "measurement_context_missing"
    IMPORTANT_INFORMATION_ABSENT = "important_information_absent"
    EVIDENCE_QUALITY_LOW = "evidence_quality_low"
    ATTRIBUTION_UNCERTAIN = "attribution_uncertain"


class ContradictionType(str, Enum):
    CAREGIVER_DISAGREEMENT = "caregiver_disagreement"
    EVIDENCE_CONFLICT = "evidence_conflict"
    RECORD_DISCREPANCY = "record_discrepancy"
    TEMPORAL_INCONSISTENCY = "temporal_inconsistency"


class VulnerabilityFactor(str, Enum):
    KNOWN_CONDITIONS = "known_conditions"
    CURRENT_MEDICATIONS = "current_medications"
    FUNCTIONAL_STATUS = "functional_status"
    COGNITIVE_BASELINE = "cognitive_baseline"
    RECENT_CHANGES = "recent_changes"
    PRIOR_RELEVANT_EVENTS = "prior_relevant_events"
    CARE_DEPENDENCIES = "care_dependencies"
    RECENT_TRANSITIONS = "recent_transitions"
    UNRESOLVED_ISSUES = "unresolved_issues"


class ActionabilityFactor(str, Enum):
    MEDICATION_ADMINISTRATION_UNCLEAR = "medication_administration_unclear"
    APPOINTMENT_APPROACHING = "appointment_approaching"
    NEW_SYMPTOM_NEEDS_DISCUSSION = "new_symptom_needs_discussion"
    CONFLICTING_CAREGIVER_REPORTS = "conflicting_caregiver_reports"
    IMPORTANT_MEASUREMENT_MISSING = "important_measurement_missing"
    FOLLOW_UP_QUESTION_UNRESOLVED = "follow_up_question_unresolved"
    CARE_DECISION_PENDING = "care_decision_pending"


class PriorityReasonCategory(str, Enum):
    NEW_DEVIATION_FROM_BASELINE = "new_deviation_from_baseline"
    WORSENING_TRAJECTORY = "worsening_trajectory"
    RECURRENT_CHANGE = "recurrent_change"
    PERSISTENT_DEVIATION = "persistent_deviation"
    UNRESOLVED_MEDICATION_QUESTION = "unresolved_medication_question"
    CAREGIVER_EXPRESSED_CONCERN = "caregiver_expressed_concern"
    CONFLICTING_EVIDENCE = "conflicting_evidence"
    UPCOMING_DECISION_POINT = "upcoming_decision_point"
    BASELINE_QUALITY_CONCERN = "baseline_quality_concern"
    FUNCTIONAL_IMPACT_DOCUMENTED = "functional_impact_documented"
    MULTIPLE_DIMENSIONS_ALIGN = "multiple_dimensions_align"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    HISTORICAL_ONLY = "historical_only"
    RESOLVED = "resolved"
    STABLE = "stable"