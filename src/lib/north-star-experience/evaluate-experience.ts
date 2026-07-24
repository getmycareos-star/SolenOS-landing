import {
  EXPERIENCE_ANTI_PATTERNS,
  EXPERIENCE_TEST_QUESTION,
  NORTH_STAR_FEELING,
  PRODUCT_PRINCIPLES,
} from "./contract-constants";
import type {
  BehavioralIndicator,
  NorthStarExperienceResult,
  ProcessNorthStarExperienceInput,
  ProductPrinciple,
} from "./types";

export function evaluateExperience(input: ProcessNorthStarExperienceInput & {
  continuity_recognition: string | null;
  related_prior_event_ids: string[];
  is_return_session: boolean;
}): Pick<
  NorthStarExperienceResult,
  | "principles_upheld"
  | "principles_gaps"
  | "anti_patterns_detected"
  | "experience_test_passed"
  | "experience_score"
  | "behavioral_indicators"
  | "emotional_outcomes_targeted"
  | "decision_trace"
> {
  const upheld: ProductPrinciple[] = [];
  const gaps: ProductPrinciple[] = [];
  const antiPatterns: string[] = [];
  const indicators: BehavioralIndicator[] = [];

  if (input.all_events.length > 0 && !input.is_first_situation) {
    upheld.push("continuity");
    indicators.push({
      id: "context_retained",
      label: "CareContext retained across sessions",
      present: true,
      evidence: `${input.all_events.length} events in continuity graph`,
    });
  } else if (input.is_first_situation) {
    upheld.push("continuity");
    indicators.push({
      id: "first_capture",
      label: "First situation captured for future continuity",
      present: true,
      evidence: "Care journey started — future sessions will build on this",
    });
  } else {
    gaps.push("continuity");
  }

  if (input.what_i_understood.length > 0 || input.events_created.length > 0) {
    upheld.push("understanding_before_responding");
  } else {
    gaps.push("understanding_before_responding");
    antiPatterns.push(EXPERIENCE_ANTI_PATTERNS[4]!);
  }

  if (input.all_events.length >= input.events_created.length && input.events_created.length > 0) {
    upheld.push("preserve_context");
    indicators.push({
      id: "context_accumulated",
      label: "History accumulates rather than resets",
      present: true,
      evidence: `${input.events_created.length} new event(s) appended to CareContext`,
    });
  } else if (input.events_created.length === 0 && !input.is_first_situation) {
    gaps.push("preserve_context");
  } else {
    upheld.push("preserve_context");
  }

  if (
    input.what_changed.length > 0 ||
    input.continuity_recognition !== null ||
    input.what_i_understood.length > 0
  ) {
    upheld.push("reduce_cognitive_load");
    indicators.push({
      id: "external_memory",
      label: "System carries context caregiver would otherwise remember",
      present: true,
      evidence: input.continuity_recognition ?? input.what_changed[0] ?? "Structured understanding surfaced",
    });
  } else {
    gaps.push("reduce_cognitive_load");
  }

  if (input.has_decision_trace && input.has_confidence_surface) {
    upheld.push("explain_thinking");
  } else {
    gaps.push("explain_thinking");
    if (!input.has_decision_trace) {
      antiPatterns.push(EXPERIENCE_ANTI_PATTERNS[6]!);
    }
  }

  if (input.continuity_recognition) {
    indicators.push({
      id: "continuity_voice",
      label: "Continuity recognition — not a new conversation",
      present: true,
      evidence: input.continuity_recognition.slice(0, 120),
    });
    indicators.push({
      id: "natural_continuation",
      label: "Natural continuation phrases recognized",
      present: true,
      evidence: "Input treated as continuation of prior care thread",
    });
  }

  if (input.is_return_session && input.related_prior_event_ids.length === 0 && input.raw_input.length > 20) {
    antiPatterns.push(EXPERIENCE_ANTI_PATTERNS[1]!);
  }

  if (input.is_first_situation && input.what_i_understood.length === 0 && input.events_created.length === 0) {
    antiPatterns.push(EXPERIENCE_ANTI_PATTERNS[5]!);
  }

  const experienceScore = Math.round(
    (upheld.length / PRODUCT_PRINCIPLES.length) * 70 +
      (input.continuity_recognition ? 15 : 0) +
      (antiPatterns.length === 0 ? 15 : Math.max(0, 15 - antiPatterns.length * 5)),
  );

  const experienceTestPassed =
    upheld.includes("continuity") &&
    upheld.includes("reduce_cognitive_load") &&
    antiPatterns.length <= 1 &&
    experienceScore >= 55;

  const emotionalOutcomes = [
    "understood",
    "oriented",
    experienceTestPassed ? "less overwhelmed" : "confident about what matters now",
    "confident context has not been forgotten",
  ] as NorthStarExperienceResult["emotional_outcomes_targeted"];

  const decisionTrace = [
    `Experience test: ${EXPERIENCE_TEST_QUESTION}`,
    `Principles upheld: ${upheld.join(", ") || "none"}`,
    ...(gaps.length > 0 ? [`Gaps: ${gaps.join(", ")}`] : []),
    ...(input.continuity_recognition
      ? [`Continuity voice: ${input.continuity_recognition.slice(0, 100)}`]
      : []),
    ...(antiPatterns.length > 0 ? [`Anti-patterns flagged: ${antiPatterns[0]}`] : []),
  ];

  return {
    principles_upheld: upheld,
    principles_gaps: gaps,
    anti_patterns_detected: antiPatterns,
    experience_test_passed: experienceTestPassed,
    experience_score: Math.min(100, experienceScore),
    behavioral_indicators: indicators,
    emotional_outcomes_targeted: emotionalOutcomes,
    decision_trace: decisionTrace,
  };
}

export { NORTH_STAR_FEELING };
