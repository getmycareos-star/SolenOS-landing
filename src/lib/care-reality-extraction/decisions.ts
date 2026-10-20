/**
 * Decision extraction — choices with who / why / evidence / outcome.
 * Ask: was a choice made, by whom, with what evidence, and do we know why?
 *
 * SoT: docs/02-product/solenos-decision-extraction.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type { ExtractedDecision, ExtractedEvent, ExtractedObservation } from "./types";
import { looksLikeCareDecisionFragment } from "./classify";

export const DECISION_EXTRACTION_ASK =
  "Was a choice made, by whom, with what evidence, and do we know why?";

export const DECISION_EXTRACTION_NEVER_ASK =
  "What happened? (that is Event — not Decision)";

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function decisionWhy(text: string): {
  why: string | null;
  reason_unknown: boolean;
} {
  if (
    /\bcan'?t remember why\b/i.test(text) ||
    /\bi honestly can'?t remember\b/i.test(text) ||
    /\bdon'?t (?:even )?know why\b/i.test(text) ||
    /\breason (?:is |was )?(?:unclear|unknown)\b/i.test(text)
  ) {
    return { why: null, reason_unknown: true };
  }
  if (/\bbecause\b/i.test(text)) {
    const after = text.split(/\bbecause\b/i)[1]?.trim().slice(0, 160) ?? null;
    // "because she thought…" about recipient state is not clinician decision why
    if (
      after &&
      after.length > 4 &&
      !/\b(?:she|he|they) thought\b/i.test(after) &&
      !/\bpick me up\b/i.test(after)
    ) {
      return { why: after.replace(/\.$/, ""), reason_unknown: false };
    }
  }
  if (
    /\b(?:medications?|medicine|meds?|dose|plan|treatment)\b/i.test(text) &&
    /\b(?:chang(?:ed|e)|switch(?:ed)?|start(?:ed)?|stopp(?:ed)?|adjust(?:ed)?)\b/i.test(
      text,
    )
  ) {
    // Deliberate care change without stated why → Reason unknown
    return { why: null, reason_unknown: true };
  }
  return { why: null, reason_unknown: true };
}

export function decisionWho(text: string): string[] {
  const who: string[] = [];
  if (/\bdoctor|physician|clinician|np\b|nurse practitioner|specialist\b/i.test(text)) {
    who.push("clinician");
  }
  if (/\bhospital|clinical team|care team|they (?:chang|start|stopp|told)\b/i.test(text)) {
    who.push("clinical_team");
  }
  if (/\bwe (?:decid|chose|chang|start|stopp|went with)\b/i.test(text)) {
    who.push("caregiver");
  }
  if (/\bfamily (?:decid|chose|agreed)\b/i.test(text)) {
    who.push("family");
  }
  if (who.length === 0 && /\bthey\b/i.test(text)) who.push("clinical_team");
  if (who.length === 0 && /\bwe\b/i.test(text)) who.push("caregiver");
  if (who.length === 0) who.push("unknown");
  return [...new Set(who)];
}

/**
 * Recommendations / suggestions are not decisions until accepted or acted on.
 */
export function looksLikeRecommendationNotDecision(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const isSuggest =
    /\b(?:should|could|might want to|recommend(?:ed|s)?|suggest(?:ed|s)?|advised?)\b/i.test(
      t,
    );
  if (!isSuggest) return false;
  // Past deliberate action — not merely "recommended changing"
  const isActed =
    /\b(?:decid(?:ed|e)|chose|chosen|chang(?:ed)|switch(?:ed)|start(?:ed)|stopp(?:ed)|we (?:did|went)|they (?:did|chang(?:ed))|accepted|went with|opted)\b/i.test(
      t,
    );
  return !isActed;
}

export function createExtractedDecision(params: {
  raw_fragment: string;
  description?: string;
}): ExtractedDecision {
  const fragment = params.raw_fragment.trim();
  const { why, reason_unknown } = decisionWhy(fragment);
  return {
    id: newId("dec"),
    layer: "decision",
    description: (params.description ?? fragment).trim().slice(0, 240),
    who: decisionWho(fragment),
    why,
    reason_unknown,
    evidence_texts: [],
    alternatives: [],
    outcome: null,
    status: reason_unknown ? "needs_review" : "active",
    raw_fragment: fragment,
  };
}

/**
 * Attach evidence available at decision time — co-occurring observations/events.
 * Never invent clinical motives; never pull disagreement/load as evidence.
 */
export function linkDecisionEvidence(params: {
  decisions: ExtractedDecision[];
  observations: ExtractedObservation[];
  events: ExtractedEvent[];
}): void {
  for (const dec of params.decisions) {
    const evidence: string[] = [];
    // Same-fragment / overlapping capture: events in the same note are context
    for (const ev of params.events) {
      if (
        ev.raw_fragment === dec.raw_fragment ||
        dec.raw_fragment.includes(ev.description.slice(0, 24)) ||
        params.events.length === 1
      ) {
        evidence.push(ev.description);
      }
    }
    // Observations that share temporal discourse with the decision fragment
    for (const obs of params.observations) {
      const sameCapture =
        obs.raw_fragment === dec.raw_fragment ||
        params.observations.length <= 4;
      if (!sameCapture) continue;
      // Prefer observations that appear before / near medication or plan language
      if (
        /\b(?:sleep|eat|confused|confusion|fall|tired|appetite|leav)\b/i.test(
          obs.description,
        ) ||
        params.observations.length <= 3
      ) {
        evidence.push(obs.description);
      }
    }
    const uniq: string[] = [];
    for (const e of evidence) {
      if (!uniq.some((x) => x.toLowerCase() === e.toLowerCase())) uniq.push(e);
    }
    dec.evidence_texts = uniq.slice(0, 4);
  }
}

export function isExtractableDecisionFragment(text: string): boolean {
  if (looksLikeRecommendationNotDecision(text)) return false;
  return looksLikeCareDecisionFragment(text);
}
