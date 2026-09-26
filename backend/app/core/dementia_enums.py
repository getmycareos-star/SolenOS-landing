from enum import Enum


class DementiaDomain(str, Enum):
    COGNITIVE_BASELINE = "cognitive_baseline"
    FUNCTIONAL_BASELINE = "functional_baseline"
    BEHAVIORAL_CHANGES = "behavioral_changes"
    ORIENTATION = "orientation"
    MEMORY = "memory"
    COMMUNICATION = "communication"
    JUDGMENT = "judgment"
    EXECUTIVE_FUNCTION = "executive_function"
    SLEEP_WAKE_PATTERNS = "sleep_wake_patterns"
    AGITATION = "agitation"
    WANDERING = "wandering"
    REPETITIVE_BEHAVIORS = "repetitive_behaviors"
    RECOGNITION = "recognition"
    ADLS_IADLS = "adls_iadls"
    CAREGIVER_OBSERVATIONS = "caregiver_observations"
    FLUCTUATIONS = "fluctuations"
    ACUTE_CHANGES = "acute_changes"
    PROGRESSION = "progression"
    TEMPORARY_CHANGE = "temporary_change"
    SAFETY_IMPLICATIONS = "safety_implications"
    CAREGIVER_BURDEN = "caregiver_burden"


class DementiaChangeType(str, Enum):
    BASELINE_CONSISTENT = "baseline_consistent"
    NEW_CHANGE = "new_change"
    FLUCTUATION = "fluctuation"
    PROGRESSION = "progression"
    RECURRENCE = "recurrence"
    TEMPORARY_IMPROVEMENT = "temporary_improvement"
    ACUTE_ON_CHRONIC = "acute_on_chronic"
    UNKNOWN = "unknown"


class FluctuationPattern(str, Enum):
    MORNING_CLEAR_EVENING_CONFUSED = "morning_clear_evening_confused"
    ALTERNATING_DAYS = "alternating_days"
    SUNDOWNING = "sundowning"
    EPISODIC = "episodic"
    CONTINUOUS = "continuous"
    UNKNOWN = "unknown"


class SafetySignificance(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class CaregiverLanguageCategory(str, Enum):
    NOT_THEMSELVES = "not_themselves"
    IN_OWN_WORLD = "in_own_world"
    REPETITIVE_QUESTIONING = "repetitive_questioning"
    SUNDOWNING = "sundowning"
    GETTING_LOST = "getting_lost"
    HAVING_A_DAY = "having_a_day"
    DONT_KNOW_WHATS_GOING_ON = "dont_know_whats_going_on"
    AGGRESSION = "aggression"
    PARANOIA = "paranoia"
    WITHDRAWAL = "withdrawal"
    CONFUSION = "confusion"
    OTHER = "other"


class DementiaBaselineType(str, Enum):
    PERSONAL_HISTORICAL = "personal_historical"
    CAREGIVER_REPORTED = "caregiver_reported"
    CLINICAL_ASSESSMENT = "clinical_assessment"
    FUNCTIONAL_ASSESSMENT = "functional_assessment"
    COMBINED = "combined"