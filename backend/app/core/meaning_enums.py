"""Core enums for the Meaning/Contextual Understanding Engine.

Epistemic layers: Fact → State/Change → Interpretation → Hypothesis
"""

from enum import Enum


class EpistemicLevel(str, Enum):
    """Epistemic layers in the care understanding pipeline."""

    FACT = "fact"  # Level 1: Direct observation / evidence
    STATE = "state"  # Level 2: Current state or change
    INTERPRETATION = "interpretation"  # Level 3: Meaning / significance
    HYPOTHESIS = "hypothesis"  # Level 4: Causal hypothesis (never asserted)


class CausalityStatus(str, Enum):
    """Causal relationship status — never assert causation without evidence."""

    CAUSALITY_ESTABLISHED = "causality_established"
    CAUSALITY_NOT_ESTABLISHED = "causality_not_established"
    CAUSALITY_IMPLIED = "causality_implied"
    CAUSALITY_REJECTED = "causality_rejected"


class ConfidenceType(str, Enum):
    """Types of confidence — meaning confidence is distinct from evidence confidence."""

    MEANING_CONFIDENCE = "meaning_confidence"
    EVIDENCE_CONFIDENCE = "evidence_confidence"
    SIGNIFICANCE_CONFIDENCE = "significance_confidence"
    COMPLETENESS_CONFIDENCE = "completeness_confidence"


class EvidenceType(str, Enum):
    """Types of evidence sources."""

    NOTE = "note"
    MEASUREMENT = "measurement"
    MEDICATION = "medication"
    SYMPTOM = "symptom"
    LAB_RESULT = "lab_result"
    CLINICIAN_NOTE = "clinician_note"
    DOCUMENT = "document"
    VOICE = "voice"
    PHOTO = "photo"
    OTHER = "other"


class ChangeType(str, Enum):
    """Types of detected changes."""

    INCREASE = "increase"
    DECREASE = "decrease"
    NEW = "new"
    RESOLVED = "resolved"
    WORSENING = "worsening"
    IMPROVEMENT = "improvement"
    FLUCTUATION = "fluctuation"
    UNCHANGED = "unchanged"


class SignificanceLevel(str, Enum):
    """Significance assessment levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    NONE = "none"
    UNKNOWN = "unknown"


class ContradictionType(str, Enum):
    """Types of contradictions."""

    DIRECT = "direct"
    TEMPORAL = "temporal"
    SOURCE = "source"
    INTERPRETIVE = "interpretive"


class GapType(str, Enum):
    """Types of information gaps."""

    MISSING_BASELINE = "missing_baseline"
    MISSING_FOLLOWUP = "missing_followup"
    MISSING_CONTEXT = "missing_context"
    MISSING_REPORTER = "missing_reporter"
    AMBIGUOUS_MEASUREMENT = "ambiguous_measurement"
    INCOMPLETE_HISTORY = "incomplete_history"


class PriorityLevel(str, Enum):
    """Priority levels for attention."""

    IMMEDIATE = "immediate"
    URGENT = "urgent"
    ROUTINE = "routine"
    LOW = "low"
    MONITOR = "monitor"
