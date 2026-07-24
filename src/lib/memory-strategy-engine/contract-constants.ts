/** Memory Strategy Engine — selective continuity, not storage. */

export const MEMORY_STRATEGY_IDENTITY =
  "Memory is not storage. Memory is selective continuity.";

export const MEMORY_STRATEGY_DEFINING_PRINCIPLE =
  "Remember what matters, retire what no longer matters, preserve evolution of reality, and maintain explainable understanding.";

export const MEMORY_TIERS = [
  "permanent",
  "long_lived",
  "short_lived",
  "session",
] as const;

export const TIER_DEFINITIONS: Record<(typeof MEMORY_TIERS)[number], string> = {
  permanent:
    "Foundation facts — diagnoses, relationships, identity, allergies — explicit confirmation before change.",
  long_lived:
    "Weeks-to-months validity — medications, mobility baseline, care team — subject to decay, versions preserved.",
  short_lived:
    "Current journey state — symptoms, recent falls, mood — high importance today, expires unless reinforced.",
  session:
    "Current interaction only — drafts, clarifications, working context — not persistent unless promoted.",
};

export const MEMORY_DESIGN_PRINCIPLES = [
  "never_remember_everything",
  "never_overwrite_history",
  "separate_permanent_from_transient",
  "confidence_increases_or_decreases",
  "promote_only_with_evidence",
  "archive_without_deleting",
  "prefer_summaries_over_volume",
  "traceable_to_source",
  "retrieve_for_relevance_not_volume",
  "improve_continuity_or_reduce_uncertainty",
] as const;

export const PERMANENT_PATTERNS = [
  /\b(diagnos\w+|allerg\w+|date of birth|dob|primary caregiver|relationship|spouse|daughter|son)\b/i,
  /\b(religious|cultural|communication preference)\b/i,
];

export const LONG_LIVED_PATTERNS = [
  /\b(medication|med list|prescription|care team|walker|wheelchair|mobility baseline|routine|living arrangement)\b/i,
  /\b(sleep pattern|nutrition plan|baseline cognitive)\b/i,
];

export const SHORT_LIVED_PATTERNS = [
  /\b(fell|fall|fever|infection|appetite|mood|confus|symptom|pain|recovery|follow[- ]?up)\b/i,
  /\b(temporary|today|this week|recently|currently)\b/i,
];

export const SESSION_PATTERNS = [
  /\b(draft|clarification|partial|working|unsure)\b/i,
];

export const CONFIRMATION_PATTERNS = [
  /\b(confirmed|still|no change|unchanged|continues|stable|resolved|recovered)\b/i,
];

export const RESOLVED_PATTERNS = [
  /\b(recovered|resolved|no longer|back to normal|cleared|finished)\b/i,
];
