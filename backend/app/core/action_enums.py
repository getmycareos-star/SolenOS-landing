"""Core enums for the Action Intelligence Engine.

Action types correspond to the four distinct question categories:
- ASK: Questions for professional/care team input
- CHECK: Discrete verification the caregiver can perform
- MONITOR: Ongoing observation the caregiver can perform
- DO: Concrete next step the caregiver can take
- PREPARE: Preparation for upcoming events/appointments
- DOCUMENT: Information to record
- PROFESSIONAL_INPUT: Requires clinician/care team decision
- ESCALATION: Requires prompt professional review
"""

from enum import Enum


class ActionType(str, Enum):
    """Action categories — distinct and non-overlapping."""

    ASK = "ask"
    CHECK = "check"
    MONITOR = "monitor"
    DO = "do"
    PREPARE = "prepare"
    DOCUMENT = "document"
    PROFESSIONAL_INPUT = "professional_input"
    ESCALATION = "escalation"


class ActionStatus(str, Enum):
    """Action lifecycle status."""

    RECOMMENDED = "recommended"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    SUPERSEDED = "superseded"
    NO_LONGER_APPLICABLE = "no_longer_applicable"
    UNCERTAIN = "uncertain"


class ActionPriority(str, Enum):
    """Action priority levels."""

    IMMEDIATE = "immediate"
    URGENT = "urgent"
    ROUTINE = "routine"
    LOW = "low"
    DEFERRED = "deferred"
    MONITOR = "monitor"


class SafetyClassification(str, Enum):
    """Safety classification for actions."""

    ROUTINE = "routine"
    ATTENTION_WORTHY = "attention_worthy"
    PROMPT_PROFESSIONAL_REVIEW = "prompt_professional_review"
    POTENTIAL_URGENT_CONCERN = "potential_urgent_concern"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class ActionOwnership(str, Enum):
    """Who should perform the action."""

    CAREGIVER = "caregiver"
    FAMILY_COORDINATOR = "family_coordinator"
    CLINICIAN = "clinician"
    PHARMACIST = "pharmacist"
    CARE_TEAM = "care_team"
    UNKNOWN = "unknown"


class TemporalScope(str, Enum):
    """When the action is relevant."""

    NOW = "now"
    TODAY = "today"
    LATER_TODAY = "later_today"
    NEXT_APPOINTMENT = "next_appointment"
    RECURRING = "recurring"
    HISTORICAL = "historical"
    UNCERTAIN_TIMING = "uncertain_timing"


class ConfidenceType(str, Enum):
    """Types of confidence in the action engine."""

    ACTION_CONFIDENCE = "action_confidence"
    EVIDENCE_CONFIDENCE = "evidence_confidence"
    MEANING_CONFIDENCE = "meaning_confidence"
    CHANGE_CONFIDENCE = "change_confidence"