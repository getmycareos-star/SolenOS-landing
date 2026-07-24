/**
 * Care Reality output intelligence — structure understanding, don't echo.
 * SoT: docs/02-product/solenos-final-intelligence-refinement.md
 * Examples in docs are illustrations only — never product templates.
 */

import { classifyEpistemicClaim } from "../care-epistemics";
import { isNearRawCaregiverFacet } from "../output-quality";

export const CARE_REALITY_OUTPUT_PURPOSE =
  "Transform messy caregiver input into structured understanding of a person's changing care reality.";

export const CARE_REALITY_OUTPUT_TARGET =
  "I am beginning to understand the person's changing care reality.";

/** Orientation field order for caregiver-facing structure. */
export const CARE_REALITY_ORIENTATION_ORDER = [
  "what_understood_about_situation",
  "what_changed",
  "known_and_perspectives",
  "unknowns",
  "what_matters_now",
  "what_can_wait",
  "what_will_be_remembered",
  "next_useful_observation",
] as const;

/** Phrases that signal reflective echo / weak orientation — scrub when better content exists. */
export const WEAK_ORIENTATION_PHRASES = [
  "stay with what is already held",
  "open thread",
  "hard days",
  "thanks for sharing",
  "i understand how you feel",
  "you are doing great",
  "memory loss can be caused",
  "first care observations are held",
  "unknowns stay open until clearer evidence",
  "beginning to understand this care situation",
] as const;

export function containsWeakOrientation(text: string): boolean {
  const lower = text.toLowerCase();
  return WEAK_ORIENTATION_PHRASES.some((p) => lower.includes(p));
}

export type EpistemicOutputLayers = {
  observed: string[];
  interpretations: string[];
  concerns: string[];
};

/**
 * Split held lines into observation vs interpretation vs concern.
 * Uses structural cues already classified elsewhere — no scenario nouns.
 */
export function separateEpistemicOutputLayers(params: {
  factLines: readonly string[];
  latestRawText: string;
  epistemicKind?: string | null;
}): EpistemicOutputLayers {
  const observed: string[] = [];
  const interpretations: string[] = [];
  const concerns: string[] = [];

  for (const line of params.factLines) {
    const t = line.trim();
    if (!t) continue;
    if (/held as your experience|you described|not a settled fact/i.test(t)) {
      interpretations.push(t);
      continue;
    }
    if (/unsure|not sure|don'?t know|uncertain|wondering|worried whether/i.test(t)) {
      concerns.push(t);
      continue;
    }
    // Character judgments / caregiver interpretations are never "observed facts".
    if (classifyEpistemicClaim(t) === "caregiver_interpretation") {
      interpretations.push(
        /held as your experience|you described/i.test(t)
          ? t
          : `Held as your experience — not a settled fact: “${t.replace(/\.$/, "")}”.`,
      );
      continue;
    }
    observed.push(t);
  }

  // Latest raw: if purely interpretive and no observed lines yet, hold as concern/interpretation
  if (
    observed.length === 0 &&
    interpretations.length === 0 &&
    params.epistemicKind === "caregiver_interpretation" &&
    params.latestRawText.trim()
  ) {
    const clipped = params.latestRawText.trim().slice(0, 140);
    interpretations.push(
      `Held as your experience — not a settled fact: “${clipped}${clipped.length >= 140 ? "…" : ""}”`,
    );
  }

  return { observed, interpretations, concerns };
}

/**
 * Build what-matters-now from held focus + optional baseline deviation.
 * Never returns empty “Stay with what is already held” when focus exists.
 */
export function buildMattersNowFromReality(params: {
  subjectLabel: string | null;
  heldFocus: string | null;
  baselineChange: string | null;
  patternContinues?: boolean;
}): string {
  const who =
    params.subjectLabel &&
    params.subjectLabel !== "they" &&
    params.subjectLabel !== "Your loved one"
      ? params.subjectLabel
      : null;

  if (params.baselineChange?.trim()) {
    const change = params.baselineChange.trim().replace(/\.$/, "");
    return who
      ? `A change from ${who}'s usual pattern is worth noticing: ${change}. Keep watching whether it continues and what connects to it — not proving why today.`
      : `A change from their usual pattern is worth noticing: ${change}. Keep watching whether it continues and what connects to it — not proving why today.`;
  }

  if (params.heldFocus?.trim()) {
    const focus = params.heldFocus.trim().replace(/\.$/, "");
    return `Right now: ${focus}. The important thing is noticing whether this continues and what situations connect to it.`;
  }

  return who
    ? `Notice what is changing for ${who} compared with what is already held — without deciding everything tonight.`
    : "Notice what is changing compared with what is already held — without deciding everything tonight.";
}

/**
 * Monitoring language — evidence-based, not alarm, not “hard days.”
 */
export function buildMayBecomeSeriousLine(params: {
  subjectLabel: string | null;
  hasRepeatedPattern: boolean;
  hasEscalationSignal: boolean;
}): string | null {
  if (!params.hasRepeatedPattern && !params.hasEscalationSignal) return null;
  const who =
    params.subjectLabel &&
    params.subjectLabel !== "they" &&
    params.subjectLabel !== "Your loved one"
      ? params.subjectLabel
      : "them";

  return `Changes that become more frequent, affect daily activities, or look clearly different from ${who === "them" ? "their" : `${who}'s`} usual behavior are important context to keep tracking — without deciding a cause today.`;
}

/**
 * Situation summary from held care reality — Known / change / unclear layers.
 * Response Contract "what is happening" — never note echo or soft storage filler.
 */
export function buildSituationUnderstandingSummary(params: {
  heldFacts: readonly string[];
  whatChanged: string | null;
  isGathering: boolean;
  openUnknowns?: readonly string[];
}): string | null {
  if (params.isGathering && params.heldFacts.length === 0) {
    return "The picture is still incomplete — held so you do not have to reconstruct it alone.";
  }

  const facts = params.heldFacts
    .map((f) => f.trim().replace(/\.$/, ""))
    .filter((f) => f.length > 0 && !containsWeakOrientation(f))
    .slice(0, 2);

  const change = params.whatChanged?.trim().replace(/\.$/, "") ?? "";
  const unknown = (params.openUnknowns ?? [])
    .map((u) => u.trim().replace(/\?$/, ""))
    .filter((u) => u.length > 8)
    .slice(0, 1)[0];

  if (facts.length === 0) {
    if (change && !containsWeakOrientation(change)) return `${change}.`;
    return null;
  }

  const known = facts.join("; ");
  // ADR-024 — never expose Known/Likely/Unknown as caregiver panel labels.
  const parts: string[] = [`${known}.`];
  if (change && !containsWeakOrientation(change) && !facts.some((f) => change.toLowerCase().includes(f.toLowerCase().slice(0, 24)))) {
    parts.push(`Changed: ${change}.`);
  }
  if (unknown) {
    parts.push(`Still unclear: ${unknown}.`);
  }
  // Single-fact first capture: keep lean — bare fact when no layers.
  if (parts.length === 1 && facts.length === 1 && !change && !unknown) {
    return `${facts[0]}.`;
  }
  return parts.join(" ");
}

/**
 * Continuity follow-ups from held focus / decision gaps — never restate the ask, never a task list.
 * Never quote near-raw caregiver facets in “Notice whether …”.
 */
export function composeReliefFollowUps(params: {
  heldFocus: string | null;
  topUnknown: string | null;
  decisionWhyUnknown: boolean;
  max?: number;
  latestRawText?: string | null;
}): string[] {
  const max = params.max ?? 2;
  const items: string[] = [];
  const focus = params.heldFocus?.trim() ?? "";
  if (
    focus &&
    !isNearRawCaregiverFacet(focus, params.latestRawText) &&
    focus.length <= 48
  ) {
    const short = focus.replace(/\.$/, "");
    items.push(`Notice whether “${short}” continues and what surrounds it`);
  } else {
    items.push("Notice whether this continues and what else connects");
  }
  if (params.decisionWhyUnknown && items.length < max) {
    items.push("Capture why a care path was chosen when it becomes clear");
  }
  // topUnknown is the ask field — never duplicate it as follow-up chrome.
  void params.topUnknown;
  return [...new Set(items)].slice(0, max);
}

export function isFutureUsefulOrientation(params: {
  hasPersonOrBaseline: boolean;
  hasChangeOrObservation: boolean;
  hasUnknownOrAsk: boolean;
}): boolean {
  return (
    params.hasChangeOrObservation &&
    (params.hasPersonOrBaseline || params.hasUnknownOrAsk)
  );
}

/**
 * Format a baseline→change note from engine deviations — no scenario templates.
 */
export function formatBaselineChangeNote(params: {
  observation?: string | null;
  comparedToBaseline?: string | null;
  changeSummary?: string | null;
  prior?: string | null;
  current?: string | null;
}): string | null {
  const obs = params.observation?.trim() || params.current?.trim() || null;
  const prior =
    params.comparedToBaseline?.trim() || params.prior?.trim() || null;
  if (obs && prior && prior.toLowerCase() !== obs.toLowerCase()) {
    return `${obs} — different from what was usual (${prior})`;
  }
  if (params.changeSummary?.trim()) return params.changeSummary.trim();
  if (obs) return obs;
  return null;
}

/**
 * Caregiver load / uncertainty phrasing — preserve as experience, not as the care situation fact.
 * Prefer true observations when both exist.
 */
export function looksLikeCaregiverExperienceOnly(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (!t) return false;
  if (/don'?t even know where to start/.test(t)) return true;
  if (/tired of (trying to )?remember/.test(t)) return true;
  if (/^(i'?m |i am )?(overwhelmed|exhausted|so tired)\b/.test(t)) return true;
  if (/nobody else (sees|notices) this/.test(t)) return true;
  if (/^i don'?t know (what|where|how) (to|i)/.test(t) && t.length < 80) return true;
  if (/i don'?t know what matters most/.test(t)) return true;
  if (/trying to keep track of/.test(t)) return true;
  if (/every time i think i'?ve figured/.test(t)) return true;
  return false;
}

/** Prefer observation lines; keep experience lines only when nothing else is held. */
export function preferCareSituationFacts(lines: readonly string[]): string[] {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  const observations = cleaned.filter(
    (l) =>
      !looksLikeCaregiverExperienceOnly(l) &&
      !looksLikeDisagreementPerspectiveLine(l),
  );
  if (observations.length > 0) return observations;
  return cleaned;
}

/**
 * Family/third-party disagreement about caregiver concern — not a care-recipient observation.
 * Structural discourse — not a named-relative vocabulary.
 */
export function looksLikeDisagreementPerspectiveLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (
    /\b(?:thinks?|said|says)\b/i.test(t) &&
    /\b(?:worry(?:ing)?|overreact(?:ing)?|too much)\b/i.test(t)
  ) {
    return true;
  }
  if (/\bnot here every day\b/i.test(t) && /\b(?:think|worry|too much)\b/i.test(t)) {
    return true;
  }
  return false;
}
