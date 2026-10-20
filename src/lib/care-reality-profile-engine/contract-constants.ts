/** Care Reality Profile — person-specific understanding, not generic categories. */

export const CARE_REALITY_PROFILE_IDENTITY =
  "SolenOS knows this person — not just a condition category.";

export const CARE_REALITY_PROFILE_DEFINING_PRINCIPLE =
  "The Living Care Record accumulates context: fact → context → pattern → learning → understanding.";

export const PROFILE_SECTIONS = [
  "baseline_reality",
  "important_routines",
  "known_changes",
  "previous_decisions",
  "what_helped",
  "what_did_not_help",
  "family_observations",
  "unresolved_questions",
] as const;

export const MEMORY_EVOLUTION_STAGES = [
  "fact",
  "context",
  "pattern",
  "learning",
  "understanding",
] as const;

export const CARE_REALITY_PROFILE_RULES = [
  "person_specific_not_generic",
  "relationships_over_isolated_facts",
  "preserve_decision_context",
  "track_outcomes",
  "maintain_unresolved_questions",
  "never_diagnose_from_profile",
  "preserve_human_context_not_condition_labels",
] as const;

/** Person-specific human context — see future-capabilities/human-context.ts */
export const HUMAN_CONTEXT_LAYER_REF = "src/lib/future-capabilities/human-context" as const;

export const ROUTINE_PATTERNS = [
  /\b(morning routine|breakfast|medication time|evening|bedtime|appointment)\b/i,
  /\b(daily|every day|usually|typically|always)\b/i,
];

export const HELPED_PATTERNS = [
  /\b(helped|improved|calmed|worked|better after|reduced when)\b/i,
];

export const DID_NOT_HELP_PATTERNS = [
  /\b(did not help|didn't help|no improvement|failed|unsuccessful|made worse)\b/i,
];

export const DECISION_PATTERNS = [
  /\b(decided|changed|adjusted|switched|because|due to|as a result)\b/i,
];
