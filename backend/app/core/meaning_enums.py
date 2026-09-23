from enum import Enum


class EpistemicLevel(str, Enum):
    OBSERVED_FACT = "observed_fact"
    STATE_CHANGE = "state_change"
    CONTEXTUAL_INTERPRETATION = "contextual_interpretation"
    HYPOTHESIS = "hypothesis"


class TemporalScopeClassification(str, Enum):
    POINT_IN_TIME = "point_in_time"
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    CHRONIC = "chronic"
    INTERMITTENT = "intermittent"
    UNKNOWN = "unknown"


class LongitudinalPatternCategory(str, Enum):
    IMPROVING = "improving"
    DECLINING = "declining"
    STABLE = "stable"
    FLUCTUATING = "fluctuating"
    EMERGING = "emerging"
    INTERMITTENT = "intermittent"
    NOT_ENOUGH_DATA = "not_enough_data"


class BaselineRelationship(str, Enum):
    SAME_AS_BASELINE = "same_as_baseline"
    ABOVE_BASELINE = "above_baseline"
    BELOW_BASELINE = "below_baseline"
    OUTSIDE_ENVELOPE = "outside_envelope"
    NEW = "new"
    UNKNOWN = "unknown"


class EvidenceRelationship(str, Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    MIXED = "mixed"
    UNRELATED = "unrelated"
    NOT_SUPPORTED = "not_supported"


class CausalStatus(str, Enum):
    CAUSAL_RELATIONSHIP = "causal_relationship"
    ASSOCIATED = "associated"
    CORRELATION = "correlation"
    NO_CAUSAL_LINK = "no_causal_link"
    CAUSALITY_NOT_ESTABLISHED = "causality_not_established"


class MeaningConfidenceType(str, Enum):
    EVIDENCE_CONFIDENCE = "evidence_confidence"
    MEANING_CONFIDENCE = "meaning_confidence"
    UNCERTAINTY = "uncertainty"


class ContextFactorType(str, Enum):
    ENVIRONMENTAL = "environmental"
    TIMING = "timing"
    CAREGIVER_PRACTICE = "caregiver_practice"
    RESOURCE_AVAILABILITY = "resource_availability"
    TECHNICAL_FACTORS = "technical_factors"
    SOCIAL_CONTEXT = "social_context"
    PHYSICAL_CONTEXT = "physical_context"
    TEMPORAL_CONTEXT = "temporal_context"
    UNKNOWN = "unknown"


class CaregiverPerspective(str, Enum):
    CAREGIVER_REPORTED = "caregiver_reported"
    PERSON_REPORTED = "person_reported"
    OBSERVATION = "observation"
    DOCUMENTED = "documented"
    UNKNOWN = "unknown"
