/** Engine Execution Contract — engines propose transformations; they never own state. */

export const ENGINE_EXECUTION_CONTRACT_IDENTITY =
  "Engines do not define truth. Engines propose transformations of truth. Only the event-sourced system defines reality.";

export const ENGINE_EXECUTION_CONTRACT_DEFINING_PRINCIPLE =
  "Engines do not own state. Engines only produce outputs.";

export const EXECUTION_TYPES = ["deterministic", "probabilistic"] as const;
export const EXECUTION_TIMINGS = ["sync", "async"] as const;

export const MUTATION_AUTHORITY = "emit_only" as const;

export const ENGINE_CONTRACT_RULES = [
  "declare_input_schema",
  "declare_output_schema",
  "declare_execution_type",
  "declare_execution_timing",
  "no_direct_care_context_mutation",
  "outputs_must_be_traceable",
  "engine_isolation",
  "replayable_from_event_store",
] as const;

export const FORBIDDEN_ENGINE_ACTIONS = [
  "directly_edit_care_context",
  "overwrite_historical_events",
  "modify_past_outputs",
  "silently_correct_data",
  "share_mutable_state_with_other_engines",
] as const;

/** Canonical engine registry — contracts for core continuity engines. */
export const REGISTERED_ENGINE_CONTRACTS = [
  {
    name: "care_event_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["raw_input", "caregiver_id"],
    optional_inputs: ["documents", "timestamp"],
    outputs: ["care_events", "uncertainty_labels"],
  },
  {
    name: "timeline_reconstruction_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["care_events"],
    optional_inputs: ["raw_input"],
    outputs: ["timeline_nodes", "ordering_confidence"],
  },
  {
    name: "contradiction_detection_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["care_events"],
    optional_inputs: ["care_timeline"],
    outputs: ["contradiction_flags", "clarification_triggers"],
  },
  {
    name: "care_context_diff_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["prior_context", "current_context"],
    optional_inputs: ["events_created"],
    outputs: ["diff_sections", "primary_change"],
  },
  {
    name: "prioritization_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["care_events"],
    optional_inputs: ["attention_signals"],
    outputs: ["priority_rankings", "attention_event_ids"],
  },
  {
    name: "clarification_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["what_is_uncertain"],
    optional_inputs: ["raw_input"],
    outputs: ["clarification_questions"],
  },
  {
    name: "trust_layer_engine",
    execution_type: "deterministic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["care_events", "what_is_uncertain"],
    optional_inputs: ["behavior", "continuity_decay"],
    outputs: ["trust_layer_block"],
  },
  {
    name: "behavior_interpretation_engine",
    execution_type: "probabilistic" as const,
    timing: "sync" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["care_events"],
    optional_inputs: ["situation_snippets"],
    outputs: ["hypotheses", "confidence_scores", "investigation_checklist"],
  },
  {
    name: "pattern_aggregation_layer",
    execution_type: "probabilistic" as const,
    timing: "async" as const,
    mutation_authority: MUTATION_AUTHORITY,
    required_inputs: ["deidentified_feature_vectors"],
    optional_inputs: [],
    outputs: ["pattern_clusters", "transition_probabilities"],
  },
] as const;
