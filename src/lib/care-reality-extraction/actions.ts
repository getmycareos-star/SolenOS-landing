/**
 * Action extraction — something someone did in the care journey.
 * Ask: what was done, by whom, when? Never ask: was this successful? (Outcome)
 * Never ask: what choice was made? (Decision)
 *
 * Doc examples are illustrations only — discourse structure, not scenario nouns.
 */

import type { ExtractedAction } from "./types";

export const ACTION_EXTRACTION_ASK =
  "What was done, by whom, and when — without treating the deed as an outcome or a decision?";

export const ACTION_EXTRACTION_NEVER_ASK =
  "Was this successful? (Outcome) / What choice was made? (Decision)";

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

/**
 * Past-tense care deeds (called, scheduled, uploaded, contacted, took to…).
 * Structural verbs — not food/fall/medication scenario lists.
 */
export function looksLikeCareActionFragment(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 10) return false;
  // Decisions are not actions
  if (
    /\b(?:decid(?:ed|e)|chose|chosen|went with|opted|stopp(?:ed)? (?:the )?(?:medication|medicine|meds?)|discontinu)/i.test(
      t,
    )
  ) {
    return false;
  }
  // Outcomes / results are not actions
  if (
    /\b(?:afterward|afterwards|since then|as a result|improved|got better|worsened)\b/i.test(t) &&
    !/\b(?:call(?:ed)?|schedul(?:ed)?|upload(?:ed)?|contact(?:ed)?)\b/i.test(t)
  ) {
    return false;
  }
  // Intentions are not actions yet
  if (
    /\b(?:will|going to|plan(?:s|ned)? to|want(?:s)? to|should|need(?:s)? to)\b/i.test(t) &&
    !/\b(?:call(?:ed)|schedul(?:ed)|upload(?:ed)|contact(?:ed)|took)\b/i.test(t)
  ) {
    return false;
  }
  if (
    /\b(?:call(?:ed)?|contact(?:ed)?|reach(?:ed)? out|phoned)\b/i.test(t) &&
    /\b(?:doctor|physician|clinic|neurologist|specialist|nurse|care team|hospital)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(?:schedul(?:ed)?|book(?:ed)?|made)\b/i.test(t) &&
    /\b(?:appointment|visit|follow[\s-]?up|therapy|session)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:upload(?:ed)?|attach(?:ed)?|sent)\b/i.test(t) && /\b(?:document|pdf|discharge|file|photo|screenshot)\b/i.test(t)) {
    return true;
  }
  if (
    /\b(?:took|brought|drove)\b/i.test(t) &&
    /\b(?:to (?:the )?(?:doctor|clinic|hospital|appointment|ER|emergency))\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:start(?:ed)?|began)\b/i.test(t) && /\b(?:physical therapy|PT|home (?:care|support)|respite)\b/i.test(t)) {
    return true;
  }
  return false;
}

export function actionWho(text: string): string | null {
  if (/\bi\b|\bwe\b/i.test(text)) return "contributor";
  if (/\bbrother|sister|daughter|son|spouse|family\b/i.test(text)) return "family_contributor";
  if (/\bdoctor|nurse|clinician|hospital|care team\b/i.test(text)) return "clinical";
  return null;
}

export function createExtractedAction(params: {
  raw_fragment: string;
  source?: string;
}): ExtractedAction {
  const raw = params.raw_fragment.trim();
  return {
    id: newId("act"),
    layer: "action",
    description: raw.slice(0, 280),
    who: actionWho(raw),
    time: null,
    related_decision_id: null,
    source: params.source ?? "caregiver",
    raw_fragment: raw,
  };
}

export function isActionNotOutcome(action: ExtractedAction): boolean {
  return action.layer === "action";
}
