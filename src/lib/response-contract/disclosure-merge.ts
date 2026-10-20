/**
 * Relief-aligned disclosure plan — CRS stage plan merged with locked relief decision.
 * SoT: docs/17-canonical-architecture/spine-build-sequence.md (Slice 1.1)
 *
 * CRS `buildDisclosurePlan` owns evidence depth + stage labels.
 * `decideReliefDisclosure` owns Clarity, asks, and what-is-happening disclosure.
 */

import type { DisclosurePlan } from "../care-reality-state/disclosure";
import type { ReliefDisclosureDecision } from "./relief-decision";

export const DISCLOSURE_MERGE_PURPOSE =
  "Single caregiver disclosure authority — relief tree wins Clarity/asks; CRS retains evidence maturity.";

export function mergeReliefIntoDisclosurePlan(params: {
  crsPlan: DisclosurePlan;
  relief: ReliefDisclosureDecision;
  composed: {
    show_clarity: boolean;
    show_questions: boolean;
    still_unclear_count: number;
    what_we_know_count: number;
    has_situation_summary: boolean;
    has_what_changed: boolean;
    observation_count: number;
    /** Composer-owned — returning continuity section only when set. */
    show_connection?: boolean;
  };
  showAttentionLevel?: boolean;
}): DisclosurePlan {
  const { crsPlan, relief, composed } = params;

  const showClarity = composed.show_clarity && relief.show_clarity;
  const showQuestions = composed.show_questions && relief.show_asks;

  let maxQuestions = 0;
  if (showQuestions && relief.max_asks > 0) {
    const cap = Math.max(crsPlan.max_questions, 1);
    maxQuestions = Math.min(
      cap,
      relief.max_asks,
      composed.still_unclear_count > 0
        ? composed.still_unclear_count
        : relief.max_asks,
    );
  }

  const showSituationSummary =
    relief.show_what_is_happening &&
    (composed.has_situation_summary ||
      (showClarity && crsPlan.show_situation_summary));

  // Understanding deltas surface when multiple captures exist — not only after Clarity unlock.
  // Notes-app deltas are already scrubbed before has_what_changed is set.
  const showWhatChanged =
    composed.observation_count > 1 &&
    (composed.has_what_changed || (showClarity && crsPlan.show_what_changed));

  const showCurrentUnderstanding =
    composed.what_we_know_count > 0 ||
    relief.show_what_is_happening ||
    (crsPlan.show_current_understanding &&
      relief.mode !== "awaiting_care_evidence" &&
      relief.mode !== "product_meta_turn");

  return {
    ...crsPlan,
    show_what_matters_now: showClarity,
    show_questions: showQuestions,
    max_questions: maxQuestions,
    show_what_changed: showWhatChanged,
    show_situation_summary: showSituationSummary,
    show_current_understanding: showCurrentUnderstanding,
    show_remembered: showClarity && crsPlan.show_remembered,
    show_insufficiency: false,
    show_connection: composed.show_connection === true,
    show_attention_level:
      params.showAttentionLevel ??
      (showClarity ? crsPlan.show_attention_level : false),
  };
}

/** Pre-composer ingest — relief overrides Clarity/asks only; CRS keeps evidence-stage fields. */
export function applyReliefFieldsToDisclosurePlan(params: {
  crsPlan: DisclosurePlan;
  relief: ReliefDisclosureDecision;
}): DisclosurePlan {
  let maxQuestions = 0;
  if (params.relief.show_asks && params.relief.max_asks > 0) {
    maxQuestions = Math.min(
      Math.max(params.crsPlan.max_questions, 1),
      params.relief.max_asks,
    );
  }
  return {
    ...params.crsPlan,
    show_what_matters_now: params.relief.show_clarity,
    show_questions: params.relief.show_asks,
    max_questions: maxQuestions,
    show_remembered: params.relief.show_clarity && params.crsPlan.show_remembered,
    show_attention_level:
      params.relief.show_clarity && params.crsPlan.show_attention_level,
  };
}

/** Pre-composer ingest projection — relief only (no composed fields yet). */
export function disclosurePlanFromReliefOnly(params: {
  crsPlan: DisclosurePlan;
  relief: ReliefDisclosureDecision;
  observationCount: number;
}): DisclosurePlan {
  return mergeReliefIntoDisclosurePlan({
    crsPlan: params.crsPlan,
    relief: params.relief,
    composed: {
      show_clarity: params.relief.show_clarity,
      show_questions: params.relief.show_asks,
      still_unclear_count: params.relief.max_asks,
      what_we_know_count: params.observationCount > 0 ? 1 : 0,
      has_situation_summary: params.relief.show_what_is_happening,
      has_what_changed: false,
      observation_count: params.observationCount,
    },
  });
}
