import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ActiveCareSituation } from "../active-care-situation/types";
import type { OpenContradiction } from "../contradiction-detection-engine/types";
import type { ConfidenceLevel } from "../care-event-integrity/types";
import type {
  DomainCategory,
  RelationshipStrength,
  SituationStatus,
} from "./contract-constants";

export type CrossDomainRelationship = {
  id: string;
  source_event_id: string;
  target_event_id: string;
  source_domain: DomainCategory;
  target_domain: DomainCategory;
  strength: RelationshipStrength;
  confidence: ConfidenceLevel;
  basis: string;
  temporal_relationship?: {
    source_event_time: string;
    target_event_time: string;
    proximity_days: number | null;
    ordering: "before" | "after" | "same" | "unknown";
  };
  evidence_event_ids: string[];
  uncertainty: string[];
  is_explicit_documented: boolean;
};

export type CrossDomainSituation = {
  id: string;
  care_recipient_id: string;
  status: SituationStatus;
  domains: DomainCategory[];
  participating_event_ids: string[];
  relationships: CrossDomainRelationship[];
  temporal_span: {
    start: string | null;
    end: string | null;
  };
  observed_changes: string[];
  contextual_links: string[];
  confidence: ConfidenceLevel;
  uncertainty: string[];
  explanation: string;
  evidence_trail: Array<{
    event_id: string;
    source_type: string;
    timestamp: string;
    excerpt: string;
  }>;
  contradictions: Array<{
    event_ids: [string, string];
    description: string;
  }>;
  missing_information: string[];
  detected_at: string;
  updated_at: string;
};

export type DomainParticipation = {
  domain: DomainCategory;
  event_count: number;
  event_ids: string[];
  changes: string[];
};

export type CrossDomainReasoningInput = {
  care_recipient_id: string;
  events: CanonicalCareEvent[];
  active_situation?: ActiveCareSituation | null;
  contradictions?: OpenContradiction[];
  as_of?: string;
};

export type CrossDomainReasoningResult = {
  situations: CrossDomainSituation[];
  event_to_situation_map: Record<string, string[]>;
  updated_event_ids: string[];
  domains_participated: DomainCategory[];
  summary: string;
};

export type EventDomainAssignment = {
  event_id: string;
  domains: DomainCategory[];
  primary_domain: DomainCategory;
  confidence: ConfidenceLevel;
};

export type RelationshipCandidate = {
  source_event_id: string;
  target_event_id: string;
  source_domains: DomainCategory[];
  target_domains: DomainCategory[];
  same_domain: boolean;
  temporal_proximity_days: number | null;
  temporal_ordering: "before" | "after" | "same" | "unknown";
  shared_context: string[];
  explicit_connection: boolean;
  explicit_evidence: string;
  baseline_deviation: boolean;
  contradicts: boolean;
};
