/**
 * Care Reality Engine — behavior example catalog (illustration only).
 * SoT: docs/02-product/solenos-care-reality-engine-foundation.md
 *
 * These are NOT product features or hardcoded scenarios.
 * They define pattern intents the engine must satisfy for any care domain.
 */

export const CRE_BEHAVIOR_EXAMPLES_PURPOSE =
  "Examples demonstrate reasoning patterns — never hardcoded eating/fall/medication/dementia detectors.";

export const CRE_FORBIDDEN_SCENARIO_DETECTORS = [
  "eating_detector",
  "fall_detector",
  "medication_assistant",
  "dementia_detector",
  "document_summarizer_product",
  "caregiver_chatbot",
] as const;

export type CreBehaviorExampleId =
  | "E01"
  | "E02"
  | "E03"
  | "E04"
  | "E05"
  | "E06"
  | "E07"
  | "E08"
  | "E09"
  | "E10"
  | "E11"
  | "E12"
  | "E13"
  | "E14"
  | "E15"
  | "E16"
  | "E17"
  | "E18"
  | "E19"
  | "E20"
  | "E21"
  | "E22"
  | "E23"
  | "E24"
  | "E25"
  | "E26"
  | "E27"
  | "E28"
  | "E29"
  | "E30"
  | "E31"
  | "E32"
  | "E33"
  | "E34"
  | "E35"
  | "E36"
  | "E37"
  | "E38"
  | "E39"
  | "E40"
  | "E41"
  | "E42";

export type CreBehaviorExample = {
  id: CreBehaviorExampleId;
  /** Pattern under test — domain-agnostic. */
  pattern: string;
  /** Anti-patterns that must hard-fail. */
  forbidden: string[];
};

/** All 42 example intents — illustrations only. */
export const CRE_BEHAVIOR_EXAMPLES: readonly CreBehaviorExample[] = [
  {
    id: "E01",
    pattern: "new_concern_creates_observation_situation_unknowns",
    forbidden: ["keyword_food_branch", "invented_cause"],
  },
  {
    id: "E02",
    pattern: "improvement_does_not_delete_history",
    forbidden: ["silent_resolve_delete"],
  },
  {
    id: "E03",
    pattern: "document_becomes_evidence_events_unknowns",
    forbidden: ["document_summary_product", "task_checklist_product"],
  },
  {
    id: "E04",
    pattern: "decision_preserves_why_or_reason_unknown",
    forbidden: ["decision_without_context"],
  },
  {
    id: "E05",
    pattern: "multi_contributor_one_care_reality",
    forbidden: ["fragmented_realities"],
  },
  {
    id: "E06",
    pattern: "conflict_preserves_both_sources",
    forbidden: ["silent_merge_winner"],
  },
  {
    id: "E07",
    pattern: "emotion_only_no_burnout_score",
    forbidden: ["burnout_diagnosis", "caregiver_score_ui"],
  },
  {
    id: "E08",
    pattern: "return_restores_continuity",
    forbidden: ["welcome_restart_first_record"],
  },
  {
    id: "E09",
    pattern: "long_thread_multiple_objects_not_summary",
    forbidden: ["single_chat_summary_product"],
  },
  {
    id: "E10",
    pattern: "related_change_links_not_instant_new_situation",
    forbidden: ["always_new_situation", "invented_causation"],
  },
  {
    id: "E11",
    pattern: "unknown_why_first_class",
    forbidden: ["invented_side_effect_reason"],
  },
  {
    id: "E12",
    pattern: "baseline_transition_not_isolated_note",
    forbidden: ["note_only_storage"],
  },
  {
    id: "E13",
    pattern: "question_retrieves_decision_memory",
    forbidden: ["invent_missing_history"],
  },
  {
    id: "E14",
    pattern: "same_event_multi_source_merge",
    forbidden: ["duplicate_unrelated_events"],
  },
  {
    id: "E15",
    pattern: "caregiver_correction_updates_understanding",
    forbidden: ["defend_wrong_interpretation"],
  },
  {
    id: "E16",
    pattern: "one_person_not_condition_silos",
    forbidden: ["condition_separate_records"],
  },
  {
    id: "E17",
    pattern: "memory_decay_supersedes_current",
    forbidden: ["keep_outdated_as_current"],
  },
  {
    id: "E18",
    pattern: "overload_asks_priority_not_checklist",
    forbidden: ["twenty_item_task_list"],
  },
  {
    id: "E19",
    pattern: "noisy_input_accepted",
    forbidden: ["reject_messy_input"],
  },
  {
    id: "E20",
    pattern: "golden_test_care_reality_chain",
    forbidden: ["summary_only", "task_only", "chat_only"],
  },
  {
    id: "E21",
    pattern: "unknowns_preserved_not_filled",
    forbidden: ["false_certainty_cause"],
  },
  {
    id: "E22",
    pattern: "timeline_shows_transitions",
    forbidden: ["upload_log_as_timeline"],
  },
  {
    id: "E23",
    pattern: "episode_emerges_from_relationships",
    forbidden: ["manual_episode_for_every_event"],
  },
  {
    id: "E24",
    pattern: "phase_context_shapes_meaning",
    forbidden: ["interpret_without_context"],
  },
  {
    id: "E25",
    pattern: "memory_is_understanding_not_messages",
    forbidden: ["chat_history_as_memory"],
  },
  {
    id: "E26",
    pattern: "memory_decay_on_new_evidence",
    forbidden: ["outdated_active_truth"],
  },
  {
    id: "E27",
    pattern: "tasks_emerge_from_understanding",
    forbidden: ["instant_task_from_observation"],
  },
  {
    id: "E28",
    pattern: "action_has_owner_when_stated",
    forbidden: ["ownerless_action_as_default_product"],
  },
  {
    id: "E29",
    pattern: "commitment_is_agreement_not_task_list",
    forbidden: ["commitment_as_todo_app"],
  },
  {
    id: "E30",
    pattern: "appointment_is_care_event",
    forbidden: ["calendar_only_object"],
  },
  {
    id: "E31",
    pattern: "preference_is_person_context",
    forbidden: ["symptom_only_person"],
  },
  {
    id: "E32",
    pattern: "routine_change_vs_baseline",
    forbidden: ["isolated_routine_fact"],
  },
  {
    id: "E33",
    pattern: "capacity_transition_tracked",
    forbidden: ["static_capacity_only"],
  },
  {
    id: "E34",
    pattern: "caregiver_context_not_primary_story",
    forbidden: ["caregiver_replaces_recipient"],
  },
  {
    id: "E35",
    pattern: "load_signals_internal_no_scores",
    forbidden: ["burnout_percent_ui"],
  },
  {
    id: "E36",
    pattern: "relationships_over_isolated_facts",
    forbidden: ["disconnected_note_pile"],
  },
  {
    id: "E37",
    pattern: "priority_from_care_reality",
    forbidden: ["task_priority_lanes"],
  },
  {
    id: "E38",
    pattern: "risk_signal_not_diagnosis",
    forbidden: ["high_risk_certainty_claim"],
  },
  {
    id: "E39",
    pattern: "transition_preserves_before_after",
    forbidden: ["current_state_only"],
  },
  {
    id: "E40",
    pattern: "resolution_lifecycle_not_delete",
    forbidden: ["erase_on_improve"],
  },
  {
    id: "E41",
    pattern: "historical_snapshot_not_rewritten",
    forbidden: ["hindsight_rewrite"],
  },
  {
    id: "E42",
    pattern: "care_narrative_not_doc_summary",
    forbidden: ["document_summary_narrative"],
  },
] as const;

export const CRE_BEHAVIOR_PASS_RATE_TARGET = 0.95;

export function creBehaviorExampleCount(): number {
  return CRE_BEHAVIOR_EXAMPLES.length;
}
