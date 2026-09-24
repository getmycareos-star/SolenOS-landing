from enum import Enum


class RevisionType(str, Enum):
    SUPERSEDE = "supersede"
    CORRECTION = "correction"
    UPDATE = "update"
    VERSION_SUPERSESSION = "version_supersedence"
    INVALIDATION = "invalidation"
    RESOLUTION = "resolution"


class KnowledgeState(str, Enum):
    CURRENT = "current"
    HISTORICAL = "historical"
    SUPERSEDED = "superseded"
    CORRECTED = "corrected"
    INVALIDATED = "invalidated"
    RESOLVED = "resolved"
    REVISED = "revised"
    UNCERTAIN = "uncertain"
    CONFLICTING = "conflicting"
    UNKNOWN = "unknown"


class RevisionOutcome(str, Enum):
    APPLIED = "applied"
    PRESERVED_UNCERTAINTY = "preserved_uncertainty"
    CONFLICT_RECORDED = "conflict_recorded"
    AMBIGUOUS = "ambiguous"
    SAME_ENTITY = "same_entity"
    SAME_CLAIM = "same_claim"
    TEMPORALLY_APPLICABLE = "temporally_applicable"
    ACTUALLY_CONTRADICTORY = "actually_contradictory"
    RELATIONSHIP_ESTABLISHED = "relationship_established"
    NO_RELATIONSHIP = "no_relationship"
