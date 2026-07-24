/**
 * Care Signal Understanding Layer — generalized reasoning facade.
 *
 * Pipeline (never task-manager):
 *   Caregiver input → Care signals → Care state → What matters now → Missing context
 *
 * Engine-only. Never expose "care signal", category enums, or scores in caregiver UI.
 * Doc examples are illustrations only — never scenario if-branches.
 *
 * SoT: docs/02-product/solenos-care-signal-understanding.md
 */

import { extractCareRealityFromText } from "../care-reality-extraction";
import {
  classifyClinicalSituations,
  containsClinicalCategoryLeakage,
  type ClinicalSituationCategoryId,
  type ClinicalSituationClassification,
} from "../care-reality-intelligence/clinical-situation-classification";
import { looksLikeInventedCertaintyFromUncertainty } from "../care-reality-extraction/unknowns";

export const CARE_SIGNAL_UNDERSTANDING_PURPOSE =
  "Interpret caregiver input as fragments of a person's care reality — never as a task list.";

export const CARE_SIGNAL_UNDERSTANDING_PIPELINE = [
  "preserve_raw_input",
  "infer_care_signals",
  "update_care_state_understanding",
  "what_matters_now",
  "missing_context",
] as const;

export const CARE_SIGNAL_UNDERSTANDING_REJECTS = [
  "input_to_task_checklist",
  "generic_chatbot",
  "reminder_app",
  "medical_diagnosis_system",
  "rewrite_or_replace_raw_input",
  "invent_missing_facts",
] as const;

/** Abstract domain bands — engine-only; derived from clinical classification, not keyword detectors. */
export type CareSignalDomain =
  | "health_medical"
  | "daily_living"
  | "administrative_coordination"
  | "caregiver_load"
  | "unspecified";

export type CareSignalUnderstandingResult = {
  /** Exact caregiver text — never rewritten. */
  raw_input_preserved: string;
  /** Engine-only domain bands inferred from meaning structure. */
  signal_domains: CareSignalDomain[];
  /** Clinical classification used internally (never render category ids). */
  clinical: ClinicalSituationClassification;
  /** What this input reveals about current care understanding (human language). */
  care_state_understanding: string | null;
  /** Known fragments (observations / events / decisions) — not a task list. */
  known: string[];
  /** Explicit unknowns — never filled with assumptions. */
  uncertain: string[];
  /** High-value next understanding asks (≤3). */
  what_would_improve_understanding: string[];
  /** Care-impact priority focus in human language. */
  what_matters_now: string | null;
  /** Routine / load context noted without diagnosing burnout. */
  caregiver_burden_context: string | null;
  /** True when input is treated as care reality, not productivity. */
  rejects_task_pipeline: true;
  extraction_summary: {
    observations: number;
    events: number;
    decisions: number;
    actions: number;
    outcomes: number;
    unknowns: number;
  };
};

const DOMAIN_FROM_CATEGORY: Record<ClinicalSituationCategoryId, CareSignalDomain> = {
  cognitive_change: "health_medical",
  behavioral_change: "health_medical",
  safety_concern: "health_medical",
  medication_transition: "health_medical",
  functional_decline: "daily_living",
  nutrition_hydration_change: "daily_living",
  sleep_change: "daily_living",
  caregiver_strain: "caregiver_load",
  family_coordination: "administrative_coordination",
  administrative_burden: "administrative_coordination",
};

/** Forbidden in any caregiver-facing string from this layer. */
export const CARE_SIGNAL_UI_LEAKAGE_PATTERNS = [
  /\bcare signal\b/i,
  /\bsignal domains?\b/i,
  /\btask list\b/i,
  /\bchecklist of tasks\b/i,
  /\bthings to do:\b/i,
  /\bclinical category\b/i,
] as const;

export function containsCareSignalUiLeakage(blob: string): boolean {
  return CARE_SIGNAL_UI_LEAKAGE_PATTERNS.some((p) => p.test(blob));
}

/**
 * Preserve original caregiver expression exactly — no summarize/rewrite.
 */
export function preserveRawCaregiverInput(raw: string): string {
  return typeof raw === "string" ? raw : "";
}

function domainsFromClinical(
  clinical: ClinicalSituationClassification,
): CareSignalDomain[] {
  const set = new Set<CareSignalDomain>();
  for (const h of clinical.hits) {
    set.add(DOMAIN_FROM_CATEGORY[h.category] ?? "unspecified");
  }
  if (set.size === 0) set.add("unspecified");
  return [...set];
}

function humanPriorityFocus(clinical: ClinicalSituationClassification): string | null {
  if (clinical.human_orientation?.trim()) return clinical.human_orientation.trim();
  if (clinical.priority_focus === "safety_concern") {
    return "Recent changes that may affect safety deserve attention first.";
  }
  if (clinical.priority_focus === "medication_transition") {
    return "A medication-related change appears to need clearer understanding.";
  }
  if (clinical.primary.length > 0) {
    return "What changed recently for the person receiving care matters most right now.";
  }
  return null;
}

function burdenContext(clinical: ClinicalSituationClassification): string | null {
  const loadHit = clinical.hits.find(
    (h) => h.category === "caregiver_strain" || h.category === "family_coordination",
  );
  if (!loadHit) return null;
  return "Keeping track of several moving pieces is part of the care load — without labeling or scoring the caregiver.";
}

/**
 * Core facade: raw input → care-reality understanding (not tasks).
 */
export function processCareSignalUnderstanding(params: {
  raw_input: string;
  contributor_id?: string;
}): CareSignalUnderstandingResult {
  const raw_input_preserved = preserveRawCaregiverInput(params.raw_input);
  const trimmed = raw_input_preserved.trim();

  const clinical = classifyClinicalSituations({ rawText: trimmed });
  const extraction = extractCareRealityFromText({
    rawText: trimmed,
    contributorId: params.contributor_id,
    source: "caregiver",
  });

  const known: string[] = [];
  for (const o of extraction.observations.slice(0, 5)) {
    known.push(o.description);
  }
  for (const e of extraction.events.slice(0, 3)) {
    known.push(e.description);
  }
  for (const d of extraction.decisions.slice(0, 3)) {
    known.push(
      d.reason_unknown
        ? `${d.description} (reason unknown)`
        : d.why
          ? `${d.description} — ${d.why}`
          : d.description,
    );
  }
  for (const a of extraction.actions.slice(0, 3)) {
    known.push(a.description);
  }

  const uncertain: string[] = [];
  for (const u of extraction.unknowns.slice(0, 5)) {
    if (u.status === "open") uncertain.push(u.question);
  }
  // Structural gaps when decisions lack why
  for (const d of extraction.decisions) {
    if (d.reason_unknown) {
      const q = "Why this care decision was made remains unclear.";
      if (!uncertain.includes(q)) uncertain.push(q);
    }
  }

  const what_would_improve_understanding: string[] = [];
  for (const u of uncertain.slice(0, 2)) {
    what_would_improve_understanding.push(u);
  }
  if (
    what_would_improve_understanding.length < 2 &&
    extraction.observations.length > 0 &&
    extraction.decisions.length === 0
  ) {
    what_would_improve_understanding.push(
      "Whether this is different from the person's usual pattern.",
    );
  }

  const care_state_understanding =
    clinical.human_orientation?.trim() ||
    (known.length > 0
      ? "This input adds to the current understanding of the person's care situation."
      : trimmed.length > 0
        ? "This input is held as part of the care story; more context would sharpen understanding."
        : null);

  const what_matters_now = humanPriorityFocus(clinical);

  const result: CareSignalUnderstandingResult = {
    raw_input_preserved,
    signal_domains: domainsFromClinical(clinical),
    clinical,
    care_state_understanding,
    known: known.slice(0, 8),
    uncertain: uncertain.slice(0, 6),
    what_would_improve_understanding: what_would_improve_understanding.slice(0, 3),
    what_matters_now,
    caregiver_burden_context: burdenContext(clinical),
    rejects_task_pipeline: true,
    extraction_summary: {
      observations: extraction.observations.length,
      events: extraction.events.length,
      decisions: extraction.decisions.length,
      actions: extraction.actions.length,
      outcomes: extraction.outcomes.length,
      unknowns: extraction.unknowns.length,
    },
  };

  // Guard: never invent certainty from uncertainty in caregiver-facing fields
  const face = [
    result.care_state_understanding,
    result.what_matters_now,
    ...result.known,
    ...result.uncertain,
  ]
    .filter(Boolean)
    .join("\n");
  if (containsClinicalCategoryLeakage(face) || containsCareSignalUiLeakage(face)) {
    result.care_state_understanding =
      "This input is held as part of the person's care reality.";
    result.what_matters_now =
      "Clarify what changed recently for the person receiving care.";
  }
  if (looksLikeInventedCertaintyFromUncertainty(face) && result.uncertain.length > 0) {
    // Prefer uncertainty over false certainty in matters-now
    if (result.what_matters_now && /definitely|caused by|certainly/i.test(result.what_matters_now)) {
      result.what_matters_now = result.uncertain[0] ?? result.what_matters_now;
    }
  }

  return result;
}

/**
 * Caregiver-facing projection — never leaks engine jargon.
 */
export function caregiverFacingCareSignalUnderstanding(
  result: CareSignalUnderstandingResult,
): {
  what_appears_happening: string | null;
  what_matters_now: string | null;
  what_is_unclear: string[];
  what_to_ask_next: string[];
  raw_input_preserved: string;
} {
  return {
    what_appears_happening: result.care_state_understanding,
    what_matters_now: result.what_matters_now,
    what_is_unclear: result.uncertain,
    what_to_ask_next: result.what_would_improve_understanding,
    raw_input_preserved: result.raw_input_preserved,
  };
}
