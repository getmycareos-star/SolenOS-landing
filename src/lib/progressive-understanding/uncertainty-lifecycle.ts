/**
 * Phase 5.2 — uncertainty lifecycle: open → answered → CRS closed.
 * SoT: docs/02-product/solenos-open-uncertainties-return.md
 */
import type { ActiveCareSituation } from "../active-care-situation/types";
import { observationCareFact } from "../care-epistemics";
import { resolveAnsweredUncertainties } from "./resolve-uncertainty";
import { careRealityObservations, questionFamily } from "./questions";

export type UncertaintyLifecycleResult = {
  open: string[];
  resolved: string[];
};

function dedupeQuestions(questions: readonly string[]): string[] {
  const out: string[] = [];
  for (const q of questions) {
    const t = q.trim();
    if (!t) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
  }
  return out;
}

function careBlob(situation: ActiveCareSituation): string {
  return careRealityObservations(situation)
    .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }) ?? "")
    .filter(Boolean)
    .join("\n");
}

/** True when care observations already hold evidence for a gap family (timing, baseline). */
export function gapFamilySatisfiedInCareBlob(
  situation: ActiveCareSituation,
  family: string,
): boolean {
  const blob = careBlob(situation);
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

/** Drop open asks whose gap family is already satisfied in held care observations. */
export function filterOpenUncertaintiesForCareBlob(
  situation: ActiveCareSituation,
  openQuestions: readonly string[],
): string[] {
  return openQuestions.filter((q) => {
    const family = questionFamily(q);
    if (family === "timing" || family === "baseline") {
      return !gapFamilySatisfiedInCareBlob(situation, family);
    }
    return true;
  });
}

/**
 * Close gaps answered by latest note; merge with prior resolved list for CRS.
 */
export function reconcileOpenUncertainties(params: {
  situation: ActiveCareSituation;
  openQuestions: readonly string[];
  rawText: string;
  priorResolved?: readonly string[];
}): UncertaintyLifecycleResult {
  const closedByBlob: string[] = [];
  const filtered = params.openQuestions.filter((q) => {
    const family = questionFamily(q);
    if (family === "timing" || family === "baseline") {
      if (gapFamilySatisfiedInCareBlob(params.situation, family)) {
        closedByBlob.push(q);
        return false;
      }
    }
    return true;
  });
  const { remaining, resolved } = resolveAnsweredUncertainties({
    openQuestions: filtered,
    rawText: params.rawText,
  });
  const allResolved = dedupeQuestions([
    ...(params.priorResolved ?? []),
    ...closedByBlob,
    ...resolved,
  ]);
  const resolvedLower = new Set(allResolved.map((r) => r.toLowerCase()));
  const open = remaining.filter((q) => !resolvedLower.has(q.toLowerCase()));
  return { open, resolved: allResolved };
}

/**
 * Session compose filter — never re-ask the same gap in the same interaction session.
 */
export function filterSessionUncertaintyAsks(params: {
  asks: readonly string[];
  askedQuestions: readonly string[];
  resolvedUncertainties: readonly string[];
  situation: ActiveCareSituation;
  /** Proposed asks this turn — may show once even if already in asked_questions. */
  currentTurnAsks?: readonly string[];
}): string[] {
  const currentTurnLower = new Set(
    (params.currentTurnAsks ?? params.asks).map((q) => q.toLowerCase()),
  );
  const priorAskedFamilies = new Set(
    params.askedQuestions
      .filter((q) => !currentTurnLower.has(q.toLowerCase()))
      .map((q) => questionFamily(q)),
  );
  const resolvedFamilies = new Set(
    params.resolvedUncertainties.map((q) => questionFamily(q)),
  );
  const priorAskedExact = new Set(
    params.askedQuestions
      .filter((q) => !currentTurnLower.has(q.toLowerCase()))
      .map((q) => q.toLowerCase()),
  );

  return filterOpenUncertaintiesForCareBlob(params.situation, params.asks).filter((q) => {
    const ql = q.toLowerCase();
    if (priorAskedExact.has(ql)) return false;
    const family = questionFamily(q);
    if (resolvedFamilies.has(family)) return false;
    if (priorAskedFamilies.has(family)) return false;
    return true;
  });
}

/** CRS + ACS open list with blob + answer reconciliation applied. */
export function projectOpenUncertaintiesForState(params: {
  situation: ActiveCareSituation;
  crsOpen: readonly string[];
  rawText: string;
  priorResolved?: readonly string[];
}): UncertaintyLifecycleResult {
  const merged = dedupeQuestions([
    ...params.crsOpen,
    ...params.situation.open_questions,
  ]).slice(0, 8);
  return reconcileOpenUncertainties({
    situation: params.situation,
    openQuestions: merged,
    rawText: params.rawText,
    priorResolved: params.priorResolved,
  });
}
