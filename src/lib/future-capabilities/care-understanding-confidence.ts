/**
 * Care Understanding Confidence — product principle (NOT gamified scores).
 * Trust through visible gaps, not false precision.
 */

export const CARE_UNDERSTANDING_CONFIDENCE_IDENTITY =
  "What do we currently understand about this person's care reality?";

export const CARE_UNDERSTANDING_CONFIDENCE_PRINCIPLE =
  "SolenOS must never pretend to know more than it knows. Uncertainty is valuable information — make it visible.";

/** Forbidden — creates false precision and caregiver anxiety. */
export const FORBIDDEN_CONFIDENCE_UI = [
  "caregiving_confidence_percentage",
  "health_score",
  "caregiver_performance_rating",
  "wellness_score_for_care",
  "parent_care_health_score",
  "gamified_badge_or_streak",
] as const;

export const FORBIDDEN_CONFIDENCE_PATTERNS = [
  /\byour caregiving confidence:\s*\d+\s*%/i,
  /\bcare health score:\s*\d+/i,
  /\bperformance rating\b/i,
  /\byour score:\s*\d+/i,
  /\bcaregiver (?:score|rating):\s*\d+/i,
] as const;

export type UnderstandingClarityLevel = "clear" | "limited" | "unknown";

export type ReliabilityLevel = "high" | "medium" | "low";

/** Area-level understanding — clarity not measurement. */
export type CareUnderstandingArea = {
  area: string;
  clarity: UnderstandingClarityLevel;
  reliability: ReliabilityLevel;
  evidence: string[];
  missing_context?: string;
  what_would_improve?: string;
  related_event_ids?: string[];
};

export type CareUnderstandingConfidenceView = {
  computed_at: string;
  question: typeof CARE_UNDERSTANDING_CONFIDENCE_IDENTITY;
  clear_areas: CareUnderstandingArea[];
  limited_areas: CareUnderstandingArea[];
  /** Explicit gaps — "I do not know yet" is a feature. */
  unknown_areas: CareUnderstandingArea[];
  caregiver_should_feel: readonly string[];
  caregiver_should_not_feel: readonly string[];
};

export const CARE_UNDERSTANDING_FEELINGS = {
  should: [
    "I know what SolenOS understands.",
    "I know what information is missing.",
    "I know where to focus attention.",
  ],
  should_not: ["The system is judging me.", "I am failing at caregiving."],
} as const;

export const UNDERSTANDING_AREA_REQUIREMENTS = [
  "evidence_source",
  "confidence_level",
  "missing_context",
] as const;

/** Stub projector — FUTURE UI consumes this; MVP uses care_state + explicit_unknowns. */
export function projectCareUnderstandingConfidenceStub(input: {
  clear: string[];
  limited: string[];
  unknown: string[];
  as_of: string;
}): CareUnderstandingConfidenceView {
  const toArea = (
    area: string,
    clarity: UnderstandingClarityLevel,
    reliability: ReliabilityLevel,
  ): CareUnderstandingArea => ({
    area,
    clarity,
    reliability,
    evidence: clarity === "clear" ? ["CareEvent-backed (stub)"] : [],
    missing_context: clarity !== "clear" ? "More recent observations needed." : undefined,
  });

  return {
    computed_at: input.as_of,
    question: CARE_UNDERSTANDING_CONFIDENCE_IDENTITY,
    clear_areas: input.clear.map((a) => toArea(a, "clear", "high")),
    limited_areas: input.limited.map((a) => toArea(a, "limited", "medium")),
    unknown_areas: input.unknown.map((a) => toArea(a, "unknown", "low")),
    caregiver_should_feel: CARE_UNDERSTANDING_FEELINGS.should,
    caregiver_should_not_feel: CARE_UNDERSTANDING_FEELINGS.should_not,
  };
}

export function scanForbiddenConfidenceScores(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of FORBIDDEN_CONFIDENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) hits.push(match[0]);
  }
  return hits;
}
