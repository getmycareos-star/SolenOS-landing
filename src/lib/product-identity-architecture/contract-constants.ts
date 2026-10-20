/**
 * Product identity architecture contracts (P1) — strengthen Care Reality Intelligence.
 * These are architecture SoT modules. Full engines may deepen later; caregiver MVP
 * must not ship generic dementia comparison, equal-weight evidence, or isolated notes.
 */

export const STABLE_CARE_IDENTITY_CONTRACT = {
  id: "stable_care_identity",
  priority: "P1-9" as const,
  principle:
    "Every CareEvent connects to care recipient, Care Reality State, Active Care Situation, Living Care Record, timeline, and baseline — never an isolated note unless opening a new situation.",
  requiredLinks: [
    "care_recipient",
    "care_reality_state",
    "active_care_situation",
    "living_care_record",
    "timeline",
    "baseline",
  ] as const,
  status: "CONTRACT" as const,
};

export const BASELINE_VS_CHANGE_CONTRACT = {
  id: "baseline_vs_change",
  priority: "P1-10" as const,
  principle:
    "Meaning comes from change against this person's history — never generic dementia knowledge first. Baseline → Change → Pattern → Understanding.",
  evaluate: [
    "is_typical_for_this_person",
    "is_different",
    "has_happened_before",
    "becoming_more_frequent",
    "improving",
    "worsening",
  ] as const,
  neverFirst: ["generic_dementia_comparison", "population_symptom_checklist"],
  existingEngine: "src/lib/baseline-intelligence-engine",
  status: "CONTRACT" as const,
};

export const DECISION_MEMORY_CONTRACT = {
  id: "decision_memory",
  priority: "P1-11" as const,
  principle: "Preserve decisions and reasoning — not just facts.",
  requiredFields: [
    "decision",
    "reason",
    "evidence",
    "date",
    "prior_state",
    "responsible_clinician",
  ] as const,
  status: "CONTRACT" as const,
};

export const EVIDENCE_HIERARCHY_CONTRACT = {
  id: "evidence_hierarchy",
  priority: "P1-12" as const,
  principle: "Not every input deserves equal confidence. Reason from weighted evidence.",
  retainOnEveryFact: [
    "source",
    "timestamp",
    "contributor",
    "confidence",
    "verification_status",
  ] as const,
  weighting: {
    highest: ["hospital_documents", "medication_lists", "laboratory_reports"],
    medium: ["caregiver_observations", "family_updates"],
    lower: ["partial_voice_transcription", "ambiguous_memories", "incomplete_notes"],
  },
  existingEngine: "src/lib/evidence-preservation",
  status: "CONTRACT" as const,
};

export const UNDERSTANDING_LIFECYCLE_CONTRACT = {
  id: "understanding_lifecycle",
  priority: "P1-13" as const,
  principle:
    "Understanding changes over time and must never become permanently fixed. Preserve current understanding and how it evolved.",
  stagesExample: [
    "day_1_limited_evidence",
    "day_3_emerging_pattern",
    "day_7_pattern_confirmed",
    "day_30_pattern_no_longer_observed",
  ] as const,
  persistedOn: "care_reality_state.understanding_revisions",
  status: "CONTRACT" as const,
};

export const COGNITIVE_LOAD_BUDGET_CONTRACT = {
  id: "cognitive_load_budget",
  priority: "P2-4" as const,
  principle: "Every caregiver screen answers one primary question — never all at once.",
  primaryQuestions: [
    "Did solenos understand what happened?",
    "What has changed?",
    "What should I pay attention to?",
    "What information is still missing?",
  ] as const,
  status: "CONTRACT" as const,
};

export const PRODUCT_IDENTITY_NON_NEGOTIABLE =
  "The Living Care Record is the persistent history of an evolving Care Reality State — not a collection of notes.";

export const PRODUCT_IDENTITY_CONTRACTS = [
  STABLE_CARE_IDENTITY_CONTRACT,
  BASELINE_VS_CHANGE_CONTRACT,
  DECISION_MEMORY_CONTRACT,
  EVIDENCE_HIERARCHY_CONTRACT,
  UNDERSTANDING_LIFECYCLE_CONTRACT,
  COGNITIVE_LOAD_BUDGET_CONTRACT,
] as const;
