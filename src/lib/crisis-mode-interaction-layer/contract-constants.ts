/** Crisis Mode Interaction Layer — triage assistant, not chatbot. */

export const CRISIS_MODE_IDENTITY =
  "In calm moments, SolenOS helps caregivers understand. In crisis moments, SolenOS tells caregivers what to do next.";

export const CRISIS_MODE_DEFINING_PRINCIPLE =
  "As urgency increases, cognitive load must decrease.";

export const CRISIS_URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const;

export const CRISIS_BEHAVIOR_RULES = [
  "reduce_output_complexity",
  "prioritize_action_over_understanding",
  "suppress_non_essential_engines",
  "one_idea_per_line",
  "max_five_lines_per_section",
  "no_diagnosis_no_fabricated_certainty",
  "anchor_in_observed_behavior",
  "defer_non_critical_writes",
] as const;

export const HIGH_SEVERITY_EVENT_PATTERNS = [
  // Fall is gated separately (immediacy/severity required) — see fall-crisis-gate.ts
  { pattern: /\b(sudden confusion|confused suddenly|acute confusion)\b/i, label: "sudden confusion" },
  {
    pattern: /\b(refus\w+|won't|will not)\s+(food|fluid|eat|drink|water)\b/i,
    label: "refusal of food or fluids",
  },
  {
    pattern: /\b(refus\w+|won't|will not)\s+(medication|meds|pill|medicine)\b/i,
    label: "medication refusal",
  },
  { pattern: /\b(acute agitat|very agitat|extremely agitat|violent)\b/i, label: "acute agitation" },
] as const;

/** Distress that can escalate alone — not bare "help me" / "urgent" / "right now". */
export const CAREGIVER_DISTRESS_PATTERNS = [
  /\b(don't know what to do|i don't know what to do)\b/i,
  /\b(panicking|overwhelmed|can't cope)\b/i,
  /\bemergency\b/i,
] as const;

/** Soft help/urgent tokens — only count when paired with acute context (see detect-triggers). */
export const SOFT_HELP_PATTERNS = [
  /\b(help me|please help|need help)\b/i,
  /\bhelp!\b/i,
] as const;

export const SOFT_URGENT_PATTERNS = [
  // Match "urgent" but not the care setting "urgent care".
  /\burgent\b(?!\s+care\b)/i,
  /\bright now\b/i,
] as const;

export const CRISIS_SUPPRESSED_ENGINES = [
  "pattern_learning_engine",
  "long_term_analysis",
  "deep_graph_traversal",
  "detailed_explanations",
  "exploratory_analysis",
] as const;

export const MAX_LINES_PER_SECTION = 5;
export const MAX_IMMEDIATE_CONCERNS = 3;
export const URGENT_INPUT_WINDOW_MINUTES = 30;
export const URGENT_INPUT_THRESHOLD = 2;
