/**
 * Generalized Care Understanding Rules — intelligence behaviors, not keyword products.
 *
 * Caregiver language → Meaning → Care signals → Current care understanding → Next understanding
 *
 * Doc examples are illustrations only. Never hard-code pharmacy/food/fall/med if-branches.
 *
 * SoT: docs/02-product/solenos-generalized-care-understanding.md
 */

import { extractCareRealityFromText } from "../care-reality-extraction";
import { classifyEpistemicClaim } from "../care-epistemics";
import {
  looksLikeContributorLoadFragment,
} from "../care-reality-extraction/classify";
import { processCareSignalUnderstanding } from "../care-signal-understanding";
import {
  ADDITIONAL_INTELLIGENCE_BEHAVIORS,
  processAdditionalIntelligenceBehaviors,
  type AdditionalIntelligenceBehaviorsResult,
} from "./additional-behaviors";

export {
  ADDITIONAL_INTELLIGENCE_BEHAVIORS,
  processAdditionalIntelligenceBehaviors,
  type AdditionalIntelligenceBehavior,
  type AdditionalIntelligenceBehaviorsResult,
  type InferenceConfidence,
  type MemoryImportance,
} from "./additional-behaviors";

export const GENERALIZED_CARE_UNDERSTANDING_PURPOSE =
  "Care understanding engine — meaning over keywords; never a task extractor.";

export const GENERALIZED_CARE_UNDERSTANDING_PIPELINE = [
  "caregiver_language",
  "meaning",
  "care_signals",
  "current_care_understanding",
  "appropriate_next_steps",
] as const;

/** The ten locked rules — behavioral contracts, not scenario templates. */
export const GENERALIZED_CARE_UNDERSTANDING_RULES = [
  "semantic_understanding_over_keyword_matching",
  "extract_care_reality_signals_as_concepts",
  "build_and_update_living_care_state",
  "identify_importance_dynamically",
  "detect_what_can_wait",
  "generate_follow_up_questions_intelligently",
  "maintain_open_loops",
  "connect_information_across_time",
  "separate_reality_from_interpretation",
  "preserve_human_context_without_therapy_chatbot",
] as const;

export type GeneralizedCareUnderstandingRule =
  (typeof GENERALIZED_CARE_UNDERSTANDING_RULES)[number];

/** Concept bands — not fixed product categories or UI labels. */
export type CareRealitySignalConcept =
  | "event"
  | "change"
  | "decision"
  | "observation"
  | "responsibility"
  | "concern"
  | "unknown";

export type EpistemicBand = "observed" | "derived" | "unknown";

export type OpenCareLoop = {
  /** Human-language gap — never invent the answer. */
  question: string;
  /** Why closing this loop would improve understanding. */
  why_it_matters: string;
  status: "open";
};

export type GeneralizedCareUnderstandingResult = {
  raw_input_preserved: string;
  rules_applied: readonly GeneralizedCareUnderstandingRule[];
  /** Concepts present in this turn (engine-only). */
  signal_concepts: CareRealitySignalConcept[];
  /** Observed vs derived vs unknown — never present derived as fact. */
  epistemic: {
    observed: string[];
    derived: string[];
    unknown: string[];
  };
  /** Answers the eight internal processing questions (engine notes). */
  internal: {
    information_provided: string[];
    reveals_about_care_situation: string | null;
    what_changed: string | null;
    what_is_important: string | null;
    what_is_uncertain: string[];
    what_remains_in_memory: string[];
    what_needs_follow_up: string[];
    care_state_update: string | null;
  };
  open_loops: OpenCareLoop[];
  requires_attention_now: string | null;
  worth_following_up: string[];
  useful_background: string[];
  caregiver_capacity_context: string | null;
  /** True when this pass rejects task-extractor framing. */
  is_care_understanding_engine: true;
  /** Additional intelligence behaviors 1–15. */
  additional: AdditionalIntelligenceBehaviorsResult;
};

function askChangesNextStep(question: string): boolean {
  // Structural: clarifying safety/change/decision/outcome — not keyword product lists.
  const q = question.toLowerCase();
  if (q.length < 8) return false;
  if (/\b(?:why|whether|when|who|what)\b/.test(q)) return true;
  if (/\b(?:unclear|unknown|missing|confirm)\b/.test(q)) return true;
  return question.trim().endsWith("?");
}

/**
 * Generalized understanding pass for one caregiver input.
 * Composes extraction + care-signal understanding — adds epistemic bands + open loops.
 */
export function processGeneralizedCareUnderstanding(params: {
  raw_input: string;
  contributor_id?: string;
  /** Prior held lines (longitudinal) — optional; empty = first turn. */
  prior_held?: string[];
}): GeneralizedCareUnderstandingResult {
  const raw = typeof params.raw_input === "string" ? params.raw_input : "";
  const csl = processCareSignalUnderstanding({
    raw_input: raw,
    contributor_id: params.contributor_id,
  });
  const extraction = extractCareRealityFromText({
    rawText: raw,
    contributorId: params.contributor_id,
    source: "caregiver",
  });

  const signal_concepts: CareRealitySignalConcept[] = [];
  if (extraction.events.length > 0) signal_concepts.push("event");
  if (extraction.observations.length > 0) signal_concepts.push("observation");
  if (extraction.decisions.length > 0) signal_concepts.push("decision");
  if (extraction.unknowns.some((u) => u.status === "open")) {
    signal_concepts.push("unknown");
  }
  if (extraction.outcomes.length > 0 || csl.what_matters_now) {
    signal_concepts.push("change");
  }
  if (looksLikeContributorLoadFragment(raw) || csl.caregiver_burden_context) {
    signal_concepts.push("responsibility");
    signal_concepts.push("concern");
  }
  if (csl.signal_domains.includes("caregiver_load") && !signal_concepts.includes("concern")) {
    signal_concepts.push("concern");
  }

  const observed: string[] = [];
  const derived: string[] = [];
  const unknown: string[] = [];

  for (const o of extraction.observations.slice(0, 6)) {
    const claim = classifyEpistemicClaim(o.raw_fragment || o.description);
    if (claim === "caregiver_interpretation") {
      derived.push(o.description);
    } else {
      observed.push(o.description);
    }
  }
  for (const e of extraction.events.slice(0, 4)) {
    observed.push(e.description);
  }
  for (const d of extraction.decisions.slice(0, 4)) {
    observed.push(d.description);
    if (d.reason_unknown) {
      unknown.push("Why this care decision was made remains unclear.");
    } else if (d.why) {
      // Stated why is reported; still not a clinical conclusion.
      observed.push(`Stated reason held: ${d.why}`);
    }
  }
  for (const a of extraction.actions.slice(0, 3)) {
    observed.push(a.description);
  }
  for (const u of extraction.unknowns) {
    if (u.status === "open") unknown.push(u.question);
  }
  for (const u of csl.uncertain) {
    if (!unknown.includes(u)) unknown.push(u);
  }

  // Derived: care-state orientation is inference — never merge into observed.
  if (csl.care_state_understanding) {
    derived.push(csl.care_state_understanding);
  }
  if (csl.what_matters_now) {
    derived.push(csl.what_matters_now);
  }

  const prior = params.prior_held ?? [];
  const longitudinalHint =
    prior.length > 0
      ? "This input is evaluated against what is already held in the care story."
      : "This input begins or extends the care story for this person.";

  const open_loops: OpenCareLoop[] = [];
  for (const q of unknown.slice(0, 5)) {
    if (!askChangesNextStep(q)) continue;
    open_loops.push({
      question: q,
      why_it_matters: "Closing this gap would sharpen care understanding.",
      status: "open",
    });
  }
  for (const d of extraction.decisions) {
    if (d.reason_unknown && d.outcome == null) {
      open_loops.push({
        question: "Outcome after this care decision is not yet known.",
        why_it_matters: "Decisions without outcomes leave the care journey incomplete.",
        status: "open",
      });
    }
  }

  const followUps = csl.what_would_improve_understanding
    .filter((q) => askChangesNextStep(q))
    .slice(0, 3);

  const requires_attention_now = csl.what_matters_now;
  const worth_following_up = followUps;
  const useful_background = observed.slice(0, 2);

  const caregiver_capacity_context =
    csl.caregiver_burden_context ??
    (looksLikeContributorLoadFragment(raw)
      ? "Caregiver load is context for capacity — not a diagnosis or score."
      : null);

  const baseFields = {
    raw_input_preserved: csl.raw_input_preserved,
    rules_applied: GENERALIZED_CARE_UNDERSTANDING_RULES,
    signal_concepts: [...new Set(signal_concepts)],
    epistemic: {
      observed: observed.slice(0, 8),
      derived: derived.slice(0, 6),
      unknown: unknown.slice(0, 6),
    },
    internal: {
      information_provided: [...observed.slice(0, 5), ...derived.slice(0, 2)],
      reveals_about_care_situation: csl.care_state_understanding,
      what_changed:
        extraction.outcomes[0]?.description ??
        (prior.length > 0 ? "Compared with what was already held." : null),
      what_is_important: requires_attention_now,
      what_is_uncertain: unknown.slice(0, 5),
      what_remains_in_memory: [
        ...observed.slice(0, 4),
        ...extraction.decisions.map((d) => d.description).slice(0, 2),
      ],
      what_needs_follow_up: worth_following_up,
      care_state_update: [longitudinalHint, csl.care_state_understanding]
        .filter(Boolean)
        .join(" "),
    },
    open_loops: open_loops.slice(0, 5),
    requires_attention_now,
    worth_following_up,
    useful_background,
    caregiver_capacity_context,
    is_care_understanding_engine: true as const,
  };

  const additional = processAdditionalIntelligenceBehaviors({
    raw_input: raw,
    contributor_id: params.contributor_id,
    prior_held: prior,
    base: baseFields,
    extraction,
    care_signal: csl,
  });

  // Decision readiness: prefer clarifying missing info over premature next steps
  if (
    !additional.decision_readiness.ready &&
    additional.decision_readiness.missing_first.length > 0
  ) {
    baseFields.worth_following_up = additional.decision_readiness.missing_first.slice(
      0,
      3,
    );
    baseFields.internal.what_needs_follow_up = baseFields.worth_following_up;
  }

  // Cognitive overload: keep primary focus; demote background
  if (additional.cognitive_overload.primary_focus) {
    baseFields.requires_attention_now = additional.cognitive_overload.primary_focus;
    baseFields.internal.what_is_important = additional.cognitive_overload.primary_focus;
  }

  // Contradiction: surface as unknown/open loop — never overwrite prior
  if (additional.contradiction.detected && additional.contradiction.current_interpretation) {
    if (!baseFields.epistemic.unknown.includes(additional.contradiction.current_interpretation)) {
      baseFields.epistemic.unknown = [
        additional.contradiction.current_interpretation,
        ...baseFields.epistemic.unknown,
      ].slice(0, 6);
    }
  }

  return {
    ...baseFields,
    additional,
  };
}

/** Caregiver-facing projection — never leaks Observed/Derived labels as chrome. */
export function caregiverFacingGeneralizedUnderstanding(
  result: GeneralizedCareUnderstandingResult,
): {
  what_appears_happening: string | null;
  what_matters_now: string | null;
  what_is_unclear: string[];
  what_can_wait: string | null;
  raw_input_preserved: string;
} {
  return {
    what_appears_happening: result.internal.reveals_about_care_situation,
    what_matters_now: result.requires_attention_now,
    what_is_unclear: result.epistemic.unknown,
    what_can_wait:
      result.useful_background.length > 0
        ? "Background details that do not change what needs attention first."
        : null,
    raw_input_preserved: result.raw_input_preserved,
  };
}

export function presentsDerivedAsObservedFact(blob: string): boolean {
  return (
    /\b(?:definitely|certainly|caused by|is because)\b/i.test(blob) &&
    /\b(?:unknown|unclear|not sure)\b/i.test(blob)
  );
}
