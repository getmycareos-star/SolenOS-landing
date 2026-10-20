export {
  CROSS_DOMAIN_REASONING_PURPOSE,
  CROSS_DOMAIN_REASONING_DEFINING_PRINCIPLE,
  CROSS_DOMAIN_REASONING_STATUS,
  DOMAIN_CATEGORIES,
  RELATIONSHIP_STRENGTHS,
  SITUATION_STATUSES,
  CONFIDENCE_LEVELS,
  MINIMUM_DOMAINS_FOR_SITUATION,
  MINIMUM_EVENTS_FOR_SITUATION,
  MAX_SITUATIONS_PER_RECIPIENT,
  TEMPORAL_WINDOWS,
  EXPLICIT_CONNECTION_PATTERNS,
  CONTEXTUAL_LINK_PATTERNS,
  DOMAIN_MAPPING_RULES,
  DOMAIN_COMPATIBILITY,
} from "./contract-constants";

export {
  detectCrossDomainSituations,
  explainCrossDomainSituation,
  listDomainsForSituation,
  assignDomainsToEvent,
  detectWithinSituationContradictions,
} from "./detect";

export type {
  DomainCategory,
  RelationshipStrength,
  SituationStatus,
  ConfidenceLevel,
} from "./contract-constants";

export type {
  CrossDomainRelationship,
  CrossDomainSituation,
  DomainParticipation,
  CrossDomainReasoningInput,
  CrossDomainReasoningResult,
  EventDomainAssignment,
  RelationshipCandidate,
} from "./types";
