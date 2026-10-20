export const CLARIFICATION_SIGNAL_PATTERNS = [
  /\bstill don'?t understand\b/i,
  /\bwhat does that mean\b/i,
  /\bexplain again\b/i,
  /\bcan you explain\b/i,
  /\bi'?m still confused\b/i,
  /\bdoesn'?t make sense\b/i,
  /\bstill confused\b/i,
  /\bwhat do you mean\b/i,
] as const;

export const INPUT_CATEGORIES = [
  "medication",
  "symptom",
  "care_coordination",
  "general",
] as const;

export type InputCategory = (typeof INPUT_CATEGORIES)[number];
