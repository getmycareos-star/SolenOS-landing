/** Event Identity — resolve duplicates, updates, recurrences, and ongoing states. */

export const EVENT_IDENTITY_IDENTITY =
  "Event identity from evidence, provenance, timing, context, and attributes — not text similarity alone.";

export const EVENT_IDENTITY_LOOP =
  "Ingest → Identify → Classify (new/dup/update/ongoing/recurrence/ambiguous) → Resolve → Update Record";

/** Core identity resolution outcomes. */
export const EVENT_IDENTITY_RESOLUTIONS = [
  "new_event",
  "duplicate_evidence",
  "duplicate_event",
  "update_existing",
  "ongoing_state",
  "recurrence",
  "unresolved_duplicate",
  "ambiguous_insufficient_evidence",
] as const;

export type EventIdentityResolution = (typeof EVENT_IDENTITY_RESOLUTIONS)[number];

/** Evidence relationship types. */
export const EVIDENCE_RELATIONS = [
  "identical_content",
  "same_source_repeated",
  "multi_source_same_event",
  "document_version_draft_final",
  "document_version_correction",
  "document_version_update",
  "multi_system_same_measurement",
  "imported_vs_manual_entry",
  "semantic_same_event",
  "temporal_sequence_same_episode",
  "explicit_recurrence",
  "implicit_recurrence",
  "repeated_observation_stable",
  "repeated_observation_persistent",
  "unclear_relationship",
] as const;

export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

/** Failure taxonomy for event identity errors. */
export const EVENT_IDENTITY_FAILURE_LABELS = [
  "DUPLICATE_EVENT_CREATION",
  "DUPLICATE_EVIDENCE_AS_EVENT",
  "MISSED_DUPLICATE",
  "FALSE_DEDUPLICATION",
  "RECURRING_EVENT_COLLAPSE",
  "SEPARATE_EVENT_COLLAPSE",
  "ONGOING_STATE_AS_NEW_EVENT",
  "REPEATED_OBSERVATION_AS_CHANGE",
  "UPDATE_AS_NEW_EVENT",
  "CORRECTION_AS_NEW_EVENT",
  "DOCUMENT_VERSION_COLLAPSE",
  "DOCUMENT_VERSION_DUPLICATION",
  "MULTI_SOURCE_DUPLICATION",
  "CAREGIVER_REPORT_DUPLICATION",
  "EVENT_IDENTITY_ERROR",
  "EVENT_MERGE_ERROR",
  "EVENT_SPLIT_ERROR",
  "RECURRENCE_DEDUPLICATION",
  "PROVENANCE_LOSS",
  "HISTORY_CORRUPTION",
] as const;

export type EventIdentityFailureLabel = (typeof EVENT_IDENTITY_FAILURE_LABELS)[number];

/** Time windows for different identity decisions. */
export const IDENTITY_TIME_WINDOWS = {
  /** Exact duplicate detection: same content, same source, very close in time */
  exact_duplicate_ms: 10 * 60 * 1000, // 10 minutes
  /** Same event, different wording: broader window for semantic matching */
  semantic_same_event_ms: 72 * 60 * 60 * 1000, // 72 hours
  /** Document version detection: same document, updated content */
  document_version_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
  /** Recurrence detection: minimum gap between distinct events of same type */
  recurrence_min_gap_ms: 24 * 60 * 60 * 1000, // 24 hours
  /** Ongoing state: repeated observations within this window suggest same state */
  ongoing_state_window_ms: 48 * 60 * 60 * 1000, // 48 hours
} as const;

/** Confidence thresholds for identity decisions. */
export const IDENTITY_CONFIDENCE = {
  /** High confidence: strong evidence (identical content, same source, explicit links) */
  high: 0.9,
  /** Medium confidence: semantic match, timing aligns, same entities */
  medium: 0.7,
  /** Low confidence: weak signals, needs human clarification */
  low: 0.5,
  /** Below this: genuinely ambiguous, must not auto-resolve */
  ambiguous: 0.4,
} as const;

/** Event attribute keys used for identity matching. */
export const IDENTITY_ATTRIBUTES = [
  "person_id",
  "event_type",
  "event_subtype",
  "location",
  "participants",
  "circumstances",
  "associated_symptoms",
  "associated_injuries",
  "source_id",
  "source_type",
  "document_id",
  "document_version",
  "causal_links",
  "temporal_links",
  "explicit_recurrence_language",
  "measurement_value",
  "measurement_unit",
] as const;

export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number];