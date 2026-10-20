/**
 * Care Reality extraction types.
 */

export type ExtractionCategory =
  | "observation"
  | "event"
  | "decision"
  | "action"
  | "outcome"
  | "unknown"
  | "contributor_load"
  | "disagreement_perspective"
  | "skip";

export type ObservationConfidence = "low" | "medium" | "high";

export type ExtractedObservation = {
  id: string;
  layer: "observation";
  description: string;
  approximate_time: string | null;
  source: string;
  confidence: ObservationConfidence;
  raw_fragment: string;
};

export type ExtractedEvent = {
  id: string;
  layer: "event";
  description: string;
  time: string | null;
  participants: string[];
  related_observation_ids: string[];
  raw_fragment: string;
};

export type ExtractedDecision = {
  id: string;
  layer: "decision";
  description: string;
  who: string[];
  /** Stated reason — null when Reason unknown. */
  why: string | null;
  reason_unknown: boolean;
  evidence_texts: string[];
  /** Empty when alternatives unknown. */
  alternatives: string[];
  /** null = pending / not yet known. */
  outcome: string | null;
  status:
    | "active"
    | "completed"
    | "changed"
    | "reversed"
    | "uncertain"
    | "needs_review"
    | "pending";
  raw_fragment: string;
};

export type OutcomeRelatedType = "decision" | "event";

export type OutcomeStatus =
  | "observed"
  | "pending"
  | "uncertain"
  | "ongoing"
  | "resolved"
  | "changed";

/** Something someone did — not Decision and not Outcome. */
export type ExtractedAction = {
  id: string;
  layer: "action";
  description: string;
  who: string | null;
  time: string | null;
  related_decision_id: string | null;
  source: string;
  raw_fragment: string;
};

export type ExtractedOutcome = {
  id: string;
  layer: "outcome";
  /** Neutral description of what happened after an event or decision. */
  description: string;
  related_id: string | null;
  related_type: OutcomeRelatedType | null;
  time: string | null;
  evidence_texts: string[];
  status: OutcomeStatus;
  raw_fragment: string;
};

export type UnknownRelatedObjectType = "observation" | "event" | "decision";

export type UnknownStatus =
  | "open"
  | "answered"
  | "declined"
  | "no_longer_relevant";

export type ExtractedUnknown = {
  id: string;
  layer: "unknown";
  /** What is unclear / missing / needs confirmation. */
  question: string;
  /** Linked observation, event, or decision when contextual evidence supports it. */
  related_object_id: string | null;
  related_object_type: UnknownRelatedObjectType | null;
  /** Who expressed or created the uncertainty. */
  source: string;
  /** Why this missing information matters (engine note — not caregiver chrome). */
  importance: string;
  status: UnknownStatus;
  raw_fragment: string;
};

export type ExtractedNonCareFact = {
  id: string;
  layer: "contributor_load" | "disagreement_perspective";
  text: string;
  raw_fragment: string;
};

export type RelationshipKindInternal =
  | "observation_to_event"
  | "event_to_decision"
  | "decision_to_outcome"
  | "event_to_outcome"
  | "observation_to_observation"
  | "event_to_event";

export type ExtractedRelationship = {
  id: string;
  from_id: string;
  to_id: string;
  kind: RelationshipKindInternal;
  certainty: "supported" | "possible";
  evidence_note: string;
};

export type CareRealityExtractionResult = {
  observations: ExtractedObservation[];
  events: ExtractedEvent[];
  decisions: ExtractedDecision[];
  actions: ExtractedAction[];
  outcomes: ExtractedOutcome[];
  unknowns: ExtractedUnknown[];
  non_care_facts: ExtractedNonCareFact[];
  relationships: ExtractedRelationship[];
  observation_focus_lines: string[];
};
