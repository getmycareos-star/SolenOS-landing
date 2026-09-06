/** Shared valid SolenOS payload — canonical output contract schema. */

export const VERIFY_VALID_SOLENOS = {
  what_is_happening:
    "Evening medication was missed. These are the only facts stated in the input.",
  what_matters_now:
    "Confirming whether the missed evening dose was taken is the main immediate focus.",
  what_to_ask_next: "Did she take the evening dose?",
  risk_level: "medium" as const,
  what_can_wait:
    "Insurance calls and long-term scheduling can wait until medication status is clarified.",
  follow_up_items: ["Confirm medication status"],
  decision_trace: {
    events: [],
    assumptions: [],
    unknowns: [],
    evidence_sources: [],
  },
  confidence_state: {
    overall_confidence: "low" as const,
    completeness: 0,
    reasoning_limits: ["Insufficient structured information to interpret safely."],
  },
  trust_layer: {
    known: [],
    assumed: [],
    unknown: [{ statement: "Insufficient structure to surface explicit gaps", drives_clarification: true }],
    recency: { last_updated_at: null, freshness_score: 0, interpretation: "potentially outdated (>7–14 days)" },
    confidence: 0.15,
  },
  transparency_panel: {
    data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
    data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
    reason_for_output: "Awaiting structured care input to produce traceable reasoning.",
    evidence_breakdown: [],
    confidence_scores: { overall_pct: 15, tier: "low" },
    recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
    observed: [],
    inferred: [],
  },
};

/** Canonical example from semantic role contract. */
export const VERIFY_SEMANTIC_ROLE_EXAMPLE = {
  what_is_happening:
    "The father is not eating, appears unhappy, and is not taking his medication. These are the only facts stated in the input.",
  what_matters_now:
    "Not taking medication and not eating are the main immediate signals to focus on.",
  what_to_ask_next:
    "[ ] When did he stop eating or reduce food intake?\n[ ] Is he refusing medication or unable to take it?\n[ ] Has anything changed recently in his routine or health?",
  risk_level: "medium" as const,
  what_can_wait:
    "Trying to understand emotional or long-term causes can wait until basic intake and medication issues are clarified.",
};
