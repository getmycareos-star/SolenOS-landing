import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import type { ActiveCareSituation, UnderstandingStage } from "../active-care-situation/types";
import type { ObservationSignal } from "./types";
import { isCaregiverQuestionPushback } from "./resolve-uncertainty";
import {
  classifyEpistemicClaim,
  hasOrientableCareContent,
  interpretationOrganizeAsks,
  isSoftVagueMoodNote,
  observationCareFact,
} from "../care-epistemics";

/** Absolute caregiver ceiling — at most three understanding asks (never an interview). */
export const MAX_CAREGIVER_QUESTIONS = 3;
/** First observations stay lean — still allow up to three gather asks when needed. */
export const EARLY_CAREGIVER_QUESTIONS = 3;

/**
 * Collapse near-duplicate asks so caregivers are not asked the same thing in different words.
 */
export function questionFamily(q: string): string {
  const ql = q.toLowerCase();
  if (/usual|baseline|new compared|normally|different from|normal day|what was .{0,40}like/.test(ql))
    return "baseline";
  if (/when|start|began|begin|timing|pattern begin|going on|first notice/.test(ql))
    return "timing";
  if (
    /changed with care|something changed|happened recently|recent (?:hospital|medication|illness|event)|medication changed|reason for the change/.test(
      ql,
    )
  ) {
    return "care_change_context";
  }
  if (/hardest to manage|adding the most pressure/.test(ql)) return "load_context";
  // Unknown Extraction — confirmation gaps (preserve uncertainty; never invent answers)
  if (
    /needs confirmation|requires confirmation|still unclear|not held yet|confirmation would|whether .*(?:confirmation|unclear)/.test(
      ql,
    )
  ) {
    return "confirmation_gap";
  }
  if (
    /what happened|on your mind|share what|what else have you noticed|alongside this|going on with care|want held/.test(
      ql,
    )
  ) {
    return "open_share";
  }
  if (/notice happening|saw, heard|that was refused|concrete things/.test(ql)) {
    return "observable_detail";
  }
  if (
    /who is (?:it|this situation|this care story|this) about|or someone else|is this about (mom|dad)/i.test(
      ql,
    )
  ) {
    return "identity_clarification";
  }
  return `other:${ql.slice(0, 48)}`;
}

/**
 * Soft gather asks — understanding-first for any input channel (text or document).
 */
export function isUnderstandingGatherAsk(q: string): boolean {
  const family = questionFamily(q);
  return (
    family === "baseline" ||
    family === "timing" ||
    family === "care_change_context" ||
    family === "load_context" ||
    family === "open_share" ||
    family === "observable_detail" ||
    family === "identity_clarification" ||
    family === "confirmation_gap"
  );
}

/** @deprecated Prefer isUnderstandingGatherAsk — no keyword “safety” ask bank. */
export function isSafetyCriticalAsk(q: string): boolean {
  return isUnderstandingGatherAsk(q);
}

/** Caregiver-facing ask allowed by Response Contract — gap families only, never topic keywords. */
export function isCaregiverFacingAsk(q: string): boolean {
  return isUnderstandingGatherAsk(q);
}

/** Observations that are care-reality anchors — never product/session meta.
 * Thin follow-ups inherit care-worthy via prior ACS facts (Slice 5.4).
 */
export function careRealityObservations(
  situation: ActiveCareSituation,
): ActiveCareSituation["observations"] {
  const out: ActiveCareSituation["observations"] = [];
  const priorFacts: string[] = [];
  for (const o of situation.observations) {
    // Disputed priors stay as evidence in CRS — not current care-reality anchors.
    if (o.disputed_by_correction_id) continue;
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
      priorFacts,
    });
    if (fact) {
      out.push(o);
      priorFacts.push(fact);
    }
  }
  return out;
}

/** Latest observation care fact — null when product meta or non-care.
 * Uses prior ACS facts so thin thread continuations still count.
 */
export function latestCareObservationFact(situation: ActiveCareSituation): string | null {
  const obs = situation.observations;
  if (obs.length === 0) return null;
  const priorFacts: string[] = [];
  for (let i = 0; i < obs.length - 1; i++) {
    const fact = observationCareFact({
      human_fact: obs[i]!.human_fact,
      raw_text: obs[i]!.raw_text,
      priorFacts,
    });
    if (fact) priorFacts.push(fact);
  }
  const latest = obs[obs.length - 1]!;
  return observationCareFact({
    human_fact: latest.human_fact,
    raw_text: latest.raw_text,
    priorFacts,
  });
}

export function latestObservationIsCareWorthy(situation: ActiveCareSituation): boolean {
  return Boolean(latestCareObservationFact(situation));
}

export function hasCareEvidenceHeld(situation: ActiveCareSituation): boolean {
  return careRealityObservations(situation).length > 0;
}

function careBlobFrom(situation: ActiveCareSituation): string {
  return careRealityObservations(situation)
    .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? "")
    .filter(Boolean)
    .join("\n");
}

/**
 * True when baseline/timing gaps remain on care anchors (asks may still help).
 * Product/session meta never counts.
 */
export function careContextGapsRemain(params: {
  situation: ActiveCareSituation;
}): boolean {
  const careObs = careRealityObservations(params.situation);
  if (careObs.length === 0) return true;
  // Unknown Extraction: open confirmation gaps are part of care reality — never treat as complete.
  if ((params.situation.open_questions?.length ?? 0) > 0) return true;
  const blob = careBlobFrom(params.situation);
  const hasBaseline =
    /\b(usual|normally|always|new for|first time|compared with|not like|again|different from)\b/i.test(
      blob,
    );
  const hasTiming =
    /\b(when|started|yesterday|this morning|last night|today|afternoon|evening|since)\b/i.test(
      blob,
    );
  return !hasBaseline || !hasTiming;
}

/**
 * True when early notes still need context before Clarity orientation.
 * Gap-driven only — observation count alone never unlocks Clarity.
 * Product/session meta never participates (cannot fake baseline via "first time here").
 */
export function earlyGatherIncomplete(params: {
  situation: ActiveCareSituation;
  signals?: readonly ObservationSignal[];
}): boolean {
  const { situation } = params;
  const careObs = careRealityObservations(situation);
  if (careObs.length === 0) return true;

  if (careObs.some((o) => isCaregiverQuestionPushback(o.raw_text))) {
    return false;
  }

  const latest =
    observationCareFact({
      human_fact: careObs[careObs.length - 1]!.human_fact,
      raw_text: careObs[careObs.length - 1]!.raw_text,
    }) ?? "";

  // Soft-only mood lines stay gather-first (G1) — no light Clarity unlock.
  const allSoft = careObs.every((o) =>
    isSoftVagueMoodNote(
      observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? o.raw_text,
    ),
  );
  if (allSoft || isSoftVagueMoodNote(latest)) {
    const blob = careBlobFrom(situation);
    const hasBaseline =
      /\b(usual|normally|always|new for|first time|compared with|not like|again|different from)\b/i.test(
        blob,
      );
    const hasTiming =
      /\b(when|started|yesterday|this morning|last night|today|afternoon|evening|since)\b/i.test(
        blob,
      );
    const hasMoreContext =
      careObs.length >= 2 ||
      /\b(also|and then|alongside|after that)\b/i.test(blob);
    return !hasMoreContext || (!hasBaseline && !hasTiming);
  }

  // Soft-majority emotional threads (e.g. frustrated + sad + one orientable note)
  // stay gather-first until baseline or timing exists — obs count alone never unlocks.
  const softCount = careObs.filter((o) =>
    isSoftVagueMoodNote(
      observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? o.raw_text,
    ),
  ).length;
  if (softCount >= Math.ceil(careObs.length / 2) && careObs.length >= 2) {
    const blob = careBlobFrom(situation);
    const hasBaseline =
      /\b(usual|normally|always|new for|first time|compared with|not like|again|different from)\b/i.test(
        blob,
      );
    const hasTiming =
      /\b(when|started|yesterday|this morning|last night|today|afternoon|evening|since)\b/i.test(
        blob,
      );
    const hasAnyOrientable = careObs.some((o) =>
      hasOrientableCareContent(
        observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? o.raw_text,
      ),
    );
    if (!hasBaseline && !hasTiming && !hasAnyOrientable) return true;
  }

  // Orientable care content → light Response Contract orientation (relief).
  // Illustrations in docs are fixtures only — structural orientability, not phrase templates.
  if (hasOrientableCareContent(latest)) {
    return false;
  }

  const blob = careBlobFrom(situation);
  const hasBaseline =
    /\b(usual|normally|always|new for|first time|compared with|not like|again|different from)\b/i.test(
      blob,
    );
  const hasTiming =
    /\b(when|started|yesterday|this morning|last night|today|afternoon|evening|since)\b/i.test(
      blob,
    );
  // More context = second *care* note or explicit additive cues — never timing words alone.
  const hasMoreContext =
    careObs.length >= 2 ||
    /\b(also|and then|alongside|after that)\b/i.test(blob);

  // Need more context plus either baseline or timing — never obs-count or timing alone.
  return !hasMoreContext || (!hasBaseline && !hasTiming);
}

/**
 * True when enough context exists for Clarity orientation (golden G1/G7).
 * Inverse of early gather — sole gate for show_clarity in response-behavior.
 * Soft-only notes stay insufficient; orientable care can unlock light orientation.
 */
export function understandingSufficient(params: {
  situation: ActiveCareSituation;
  signals?: readonly ObservationSignal[];
}): boolean {
  return !earlyGatherIncomplete(params);
}

/** @deprecated Use earlyGatherIncomplete — kept for call-site compatibility. */
export function appetiteGatherIncomplete(params: {
  situation: ActiveCareSituation;
  signals?: readonly ObservationSignal[];
}): boolean {
  return earlyGatherIncomplete(params);
}

function subjectUsualPhrase(subject: string): string {
  if (subject === "Mom") return "her usual";
  if (subject === "Dad") return "his usual";
  if (subject.trim() && subject !== "Your loved one" && subject !== "they") {
    return `${subject}'s usual`;
  }
  return "their usual";
}

/**
 * Understanding-gap asks for early gather — same families for any topic.
 * Never fall→head / eat→fluids keyword templates (golden G1 / G7).
 */
export function understandingGapAsks(subject: string): string[] {
  const usual = subjectUsualPhrase(subject);
  return [
    `Is this different from ${usual}?`,
    "When did this start — or has it been going on?",
    "What else have you noticed alongside this?",
  ];
}

/**
 * Next caregiver-facing questions — two-step gather ladder:
 * Step 1 (first note): one context invite — no Clarity, no 3-ask dump.
 * Step 2 (more context, still incomplete): 2–3 prioritized gap asks.
 * Never fall→head / eat→fluids keyword templates.
 */
export function nextQuestionsForUnderstanding(params: {
  situation: ActiveCareSituation;
  stage: UnderstandingStage;
  latestKind: CareEventKind;
  latestText: string;
  signals: readonly ObservationSignal[];
  patternLabel: string | null;
  remainingOpen: readonly string[];
  maxQuestions?: number;
}): string[] {
  const { situation, latestText, remainingOpen, signals } = params;
  void params.latestKind;
  void params.stage;
  void params.patternLabel;

  const careObs = careRealityObservations(situation);
  const careCount = careObs.length;
  const obsCount = careCount > 0 ? careCount : situation.observations.length;
  const step1 = obsCount <= 1;
  const limit =
    params.maxQuestions !== undefined
      ? params.maxQuestions
      : step1
        ? 1
        : MAX_CAREGIVER_QUESTIONS;

  if (limit <= 0) return [];

  const shownFamilies = new Set<string>();
  for (const q of situation.asked_questions) {
    shownFamilies.add(questionFamily(q));
  }
  for (const q of remainingOpen) {
    shownFamilies.add(questionFamily(q));
  }

  // G37 — interpretation without observables: organize confusion
  if (classifyEpistemicClaim(latestText) === "caregiver_interpretation") {
    const fresh: string[] = [];
    const usedFamilies = new Set<string>(shownFamilies);
    for (const q of interpretationOrganizeAsks(situation.subject_label)) {
      const family = questionFamily(q);
      if (usedFamilies.has(family)) continue;
      usedFamilies.add(family);
      fresh.push(q);
      if (fresh.length >= Math.min(limit, 2)) break;
    }
    return fresh;
  }

  // Step 1 — first *care* note: one calm context invite only.
  // Product/session meta must never consume the open_share family.
  if (step1) {
    const invite = "What else have you noticed alongside this?";
    if (!shownFamilies.has(questionFamily(invite))) {
      return [invite].slice(0, Math.min(limit, 1));
    }
    // First invite already shown — fall through to step 2 gap ladder unless still all-soft-only.
  }

  // All-soft mood notes: one invite total until orientable care content arrives (G1).
  const allSoftOnly = careObs.every((o) =>
    isSoftVagueMoodNote(
      observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? o.raw_text,
    ),
  );
  if (allSoftOnly && shownFamilies.has("open_share")) {
    return [];
  }

  // Clarity may already be unlocked (orientable care), but baseline/timing gaps can remain.
  if (
    !earlyGatherIncomplete({ situation, signals }) &&
    !careContextGapsRemain({ situation })
  ) {
    return [];
  }

  // Step 2 — more context held: prioritize remaining gaps (baseline → timing → open_share)
  const fresh: string[] = [];
  const usedFamilies = new Set<string>(shownFamilies);
  for (const q of understandingGapAsks(situation.subject_label)) {
    const family = questionFamily(q);
    if (usedFamilies.has(family)) continue;
    if (gapFamilySatisfiedInCareBlob(situation, family)) continue;
    usedFamilies.add(family);
    fresh.push(q);
    if (fresh.length >= Math.min(limit, 3)) break;
  }
  return fresh;
}

function gapFamilySatisfiedInCareBlob(
  situation: ActiveCareSituation,
  family: string,
): boolean {
  const blob = careBlobFrom(situation);
  if (family === "timing") {
    return /\b(when|started|began|yesterday|this morning|last night|today|hour|minute|since|ago|week|month)\b/i.test(
      blob,
    );
  }
  if (family === "baseline") {
    return /\b(usual|normally|always|new for|first time|compared with|not like|again|different from|typical)\b/i.test(
      blob,
    );
  }
  return false;
}

export function rememberedThemesForUnderstanding(
  situation: ActiveCareSituation,
  patternLabel: string | null,
): string[] {
  if (situation.theme === "emotional_behavior" || patternLabel) {
    return [
      "Today's emotional and behavioral observations",
      patternLabel
        ? `Whether a ${patternLabel} continues over time`
        : "Whether this becomes a pattern over time",
      "What helps and what came before changes",
    ];
  }
  return [
    "Care timeline continuity",
    "What changed over time",
    "Open questions that still need context",
  ];
}
