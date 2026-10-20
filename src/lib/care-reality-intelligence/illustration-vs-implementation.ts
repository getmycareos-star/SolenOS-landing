/**
 * Illustration vs Implementation Separation.
 * Doc examples teach reasoning — never become product data, UI defaults, or scenario code.
 *
 * SoT: docs/02-product/solenos-illustration-vs-implementation.md
 */

export const ILLUSTRATION_VS_IMPLEMENTATION_PURPOSE =
  "Implement the intelligence behind architecture examples — never the example sentences, names, or stories as product.";

export const ILLUSTRATION_PRE_COMMIT_GATE =
  "Am I implementing the intelligence behind this example, or am I accidentally implementing the example itself?";

/** Universal care-reality objects — build around these, not illustration nouns. */
export const UNIVERSAL_CARE_REALITY_OBJECTS = [
  "care_recipient",
  "observation",
  "change_detection",
  "related_event",
  "decision",
  "outcome",
  "unknown",
] as const;

/** Doc markers that mean “understand behavior,” never “ship this content.” */
export const ILLUSTRATION_DOC_MARKERS = [
  "Example:",
  "Imagine:",
  "Scenario:",
  "Illustration:",
  "illustrations only",
] as const;

/**
 * Schema / identifier shapes that look like illustration nouns baked into product.
 * Never ship fields like these.
 */
export const ILLUSTRATION_SHAPED_SCHEMA_PATTERNS = [
  /\bmom_confusion(?:_event)?\b/i,
  /\bdad_aggression(?:_event)?\b/i,
  /\bbrother_disagreement(?:_event)?\b/i,
  /\bfall_scare_event\b/i,
  /\bleaving_house_scenario\b/i,
  /\bhospital_visit_demo\b/i,
  /\bsample_caregiver_story\b/i,
  /\bfake_timeline\b/i,
  /\bdemo_situation_default\b/i,
  /\bprefilled_patient\b/i,
] as const;

/**
 * Caregiver-facing UI defaults that look like shipped illustration stories.
 * Identity naming placeholders (invite what they call the person) are excluded — Locked A.
 */
export const ILLUSTRATION_UI_DEFAULT_PATTERNS = [
  /placeholder=['"`]e\.g\.\s*["'].*Mom asked where Dad/i,
  /placeholder=['"`].*Dad wandered outside at 2am/i,
  /\bdefaultCareStory\s*[:=]/i,
  /\bsampleCaregiverStor(?:y|ies)\b/i,
  /\bfakeTimeline\b/i,
  /\bdemoSituation(?:s)?\s*[:=]\s*\[/i,
  /\bprefilledPatient\b/i,
] as const;

/**
 * Hardcoded illustration scenario objects in production logic (not verify fixtures).
 */
export const ILLUSTRATION_SCENARIO_OBJECT_PATTERNS = [
  /\{\s*name\s*:\s*["']Mom["']\s*,\s*condition\s*:\s*["']confused["']/i,
  /\{\s*name\s*:\s*["']Mom["']\s*,\s*event\s*:\s*["']tried leaving/i,
  /condition\s*:\s*["']confused["']\s*,\s*event\s*:\s*["']tried leaving house["']/i,
] as const;

export function containsIllustrationShapedSchema(blob: string): boolean {
  return ILLUSTRATION_SHAPED_SCHEMA_PATTERNS.some((p) => p.test(blob));
}

export function containsIllustrationUiDefault(blob: string): boolean {
  return ILLUSTRATION_UI_DEFAULT_PATTERNS.some((p) => p.test(blob));
}

export function containsIllustrationScenarioObject(blob: string): boolean {
  return ILLUSTRATION_SCENARIO_OBJECT_PATTERNS.some((p) => p.test(blob));
}

export function containsIllustrationAsProduct(blob: string): boolean {
  return (
    containsIllustrationShapedSchema(blob) ||
    containsIllustrationUiDefault(blob) ||
    containsIllustrationScenarioObject(blob)
  );
}

/**
 * Gate helper for reviews / verify scripts.
 */
export function assertIllustrationNotImplementedAsProduct(blob: string, context: string): void {
  if (containsIllustrationAsProduct(blob)) {
    throw new Error(
      `Illustration vs implementation: ${context} appears to implement a doc example as product — implement the structure, not the sentence.`,
    );
  }
}
