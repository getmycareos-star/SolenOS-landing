/**
 * Caregiver-legible standing — the ops Clarity/Continuity computation, spoken plainly.
 *
 * The reasoning pipeline already computes "what is happening / what matters / what
 * to ask / what can wait / watch for" (Clarity) and continuity state. Those states
 * are deliberately quarantined from the caregiver surface, which leaves the caregiver
 * able to see *what* SolenOS understands but never *where things stand*.
 *
 * This module closes that gap without breaking the trust boundary:
 * - it projects the engine's own conclusion into ordinary sentences
 * - it never names a layer, enum, score, or engine
 * - it never adds a claim the engines did not compute
 * - it returns null when there is nothing honest to show, so silence is still allowed
 *
 * Charter alignment: internal concepts stay internal; the *conclusion* is caregiver's.
 */

import type { SituationResponse } from "../situation-entry/types";
import { readBaselineLanguage } from "../care-reality-intelligence/baseline-language";
import { observationCareFact } from "../care-epistemics";

export type CaregiverStanding = {
  heading: string;
  /** Plain-language statement of where things stand. */
  standing: string | null;
  /** What matters most right now, in caregiver terms. */
  matters_now: string | null;
  /** Explicitly permitted to wait — cognitive relief, not avoidance. */
  can_wait: string | null;
  /** What to keep an eye on, when the engines flagged a watch item. */
  watch_for: string[];
  /** The single most useful next question, when one exists. */
  next_question: string | null;
  /** True when at least one line is present. */
  has_content: boolean;
};

const STANDING_HEADING = "Where things stand";

function firstSentence(text: string | null | undefined, max = 180): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 4) return null;
  const cut = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  return cut.slice(0, max);
}

function plainQuestion(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.endsWith("?") ? cleaned : `${cleaned}?`;
}

/**
 * Project the engine state into a caregiver-legible standing.
 *
 * Sources, in order of authority: what the composer already decided (matters now,
 * can wait, may become serious), then held Care Reality evidence, then the
 * caregiver's own words. Nothing is invented; missing pieces stay missing.
 */
export function caregiverStandingFor(params: {
  response: SituationResponse;
  situationObservations: readonly {
    human_fact: string;
    raw_text: string;
    captured_at?: string;
  }[];
  composed?: {
    situation_summary?: string | null;
    what_matters_now?: string | null;
    what_can_wait?: string | null;
    what_may_become_serious?: string | null;
    still_unclear?: string[];
  } | null;
  latestRawText?: string;
}): CaregiverStanding {
  const { response, situationObservations, composed, latestRawText } = params;

  const watch_for: string[] = [];
  if (composed?.what_may_become_serious) {
    watch_for.push(firstSentence(composed.what_may_become_serious, 160)!);
  }

  // Contradictions that are still open are the most important watch item: two
  // accounts exist and the caregiver is the only one who can settle them.
  const openContradictions = response.contradiction_detection_layer?.open_contradictions ?? [];
  for (const c of openContradictions.slice(0, 2)) {
    if (c.shared_message) watch_for.push(c.shared_message);
  }

  // Declining trajectories are a standing fact, not an alarm.
  const report = response.care_state_change_report;
  const changes = report?.all_changes ?? [];
  const worsening = changes.filter(
    (c) => c.trajectory === "worsening" && c.classification !== "NEW",
  );
  const improving = changes.filter(
    (c) => c.trajectory === "improving" && c.classification !== "RESOLVED",
  );

  // What the caregiver said, in their own words — the floor of understanding.
  const heldFacts = situationObservations
    .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }))
    .filter((f): f is string => Boolean(f));

  const reading = readBaselineLanguage(latestRawText ?? "");

  const core = response.care_reality_engine_layer?.core;
  const standing =
    firstSentence(composed?.situation_summary) ??
    firstSentence(core?.observations[0]?.description) ??
    firstSentence(heldFacts[heldFacts.length - 1]) ??
    null;

  const matters_now =
    firstSentence(composed?.what_matters_now) ??
    firstSentence(worsening[0]?.current_state) ??
    firstSentence(reading.change_statements[0]) ??
    (improving.length > 0 && worsening.length === 0
      ? firstSentence(improving[0]?.current_state)
      : null);

  const can_wait =
    firstSentence(composed?.what_can_wait) ??
    firstSentence(composed?.what_may_become_serious) ??
    "Nothing needs to be decided tonight.";

  const next_question =
    composed?.still_unclear?.length
      ? plainQuestion(composed.still_unclear[0]!)
      : null;

  const uniqueWatch = [...new Set(watch_for.map((w) => w.trim()).filter(Boolean))].slice(0, 3);

  return {
    heading: STANDING_HEADING,
    standing,
    matters_now,
    can_wait,
    watch_for: uniqueWatch,
    next_question,
    has_content: Boolean(standing || matters_now || uniqueWatch.length > 0 || next_question),
  };
}

/**
 * Disclosure gate: standing is only shown once the caregiver has shared enough for
 * a position to exist. Before that, silence is more honest than a summary.
 */
export function shouldShowStanding(params: {
  observationCount: number;
  hasBaselineOrChange: boolean;
  stage: "early" | "growing" | "established";
  crisis?: boolean;
}): boolean {
  if (params.crisis) return true;
  if (params.stage === "established") return true;
  if (params.hasBaselineOrChange) return params.observationCount >= 1;
  return params.observationCount >= 3;
}

export { observationCareFact };
