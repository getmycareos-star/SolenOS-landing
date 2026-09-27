/**
 * SolenOS Intelligence Layer — Architecture Contracts
 */

export const SOLENOS_INTELLIGENCE_LAYER_IDENTITY =
  "Single unified pipeline: Extract → Understand → Reason → Communicate. No skipping stages.";

export const SOLENOS_INTELLIGENCE_LAYER_PIPELINE_POSITION = [
  "extract",
  "understand", 
  "reason",
  "communicate",
] as const;

export const SOLENOS_INTELLIGENCE_LAYER_FORBIDDEN = [
  "skip_stages",
  "reason_before_extract",
  "communicate_before_reason",
  "bypass_evidence_preservation",
  "bypass_contradiction_materialization",
  "bypass_source_reliability",
] as const;

export const STAGE_CONTRACTS = {
  extract: {
    input: "ProcessSituationInput",
    output: "events_created + events_all + raw_input",
    must: ["preserve_raw_input", "never_discard_unparseable"],
    must_not: ["reason_before_extraction_complete"],
  },
  understand: {
    input: "extraction + active_situation + care_context + care_reality_state",
    output: "continuity_decision + contradiction_detection + baseline_intelligence + continuity_properties + care_reality_state",
    must: ["detect_continuity_first", "compare_to_baseline", "track_source_reliability"],
    must_not: ["assume_continuity_without_check", "ignore_contradictions"],
  },
  reason: {
    input: "extraction + understanding",
    output: "priority_state + aggregated_confidence + contradiction_materialization + source_reliability + evidence_preservation",
    must: ["aggregate_confidence", "materialize_contradictions", "apply_source_weights", "preserve_evidence_chains"],
    must_not: ["use_single_module_confidence", "hide_uncertainty"],
  },
  communicate: {
    input: "extraction + understanding + reasoning + presentation_preference",
    output: "composed_response + presentation_view + transparency_audit",
    must: ["project_for_cognitive_load", "include_evidence", "show_uncertainty"],
    must_not: ["generate_without_reasoning", "use_generic_templates"],
  },
} as const;