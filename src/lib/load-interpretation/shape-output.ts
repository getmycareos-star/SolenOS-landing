import type { SolenOSResponse } from "../output-contract";
import {
  LOAD_FIRST_MINIMAL_ACTION,
  LOAD_FIRST_SAFE_TO_IGNORE,
} from "./contract-constants";
import type { LoadInterpretation } from "./types";

const CARE_TIP_LEAD_PATTERNS = [
  /^try (?:these|this|using)/i,
  /^consider (?:using|trying|a)/i,
  /^(?:\d+\s+)?(?:dementia|alzheimer|caregiving) (?:techniques|tips|strategies)/i,
  /^medication/i,
  /^treatment/i,
  /^understanding (?:dementia|alzheimer)/i,
  /^education:/i,
];

const CARE_TIP_CONTENT_PATTERNS = [
  ...CARE_TIP_LEAD_PATTERNS,
  /\bdementia\b/i,
  /\balzheimer/i,
  /\bcare (?:technique|tip|strategy|education)\b/i,
  /\bmedication education\b/i,
  /\btreatment (?:option|plan)\b/i,
  /\bneurology visit\b/i,
];

function looksLikeCareTipContent(text: string): boolean {
  const trimmed = text.trim();
  return CARE_TIP_CONTENT_PATTERNS.some((p) => p.test(trimmed));
}

function minimalAction(existing: string, loadFirst: boolean): string {
  if (!loadFirst) return existing;
  const trimmed = existing.trim();
  if (!trimmed || looksLikeCareTipContent(trimmed)) {
    return LOAD_FIRST_MINIMAL_ACTION;
  }
  if (trimmed.length > 120) {
    return LOAD_FIRST_MINIMAL_ACTION;
  }
  return `${LOAD_FIRST_MINIMAL_ACTION} When ready: ${trimmed}`;
}

function expandWhatCanWait(
  existing: string,
  deferredTitles: readonly string[] | undefined,
  loadFirst: boolean,
): string {
  const baseItems = existing
    .split(/\n|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const deferred = (deferredTitles ?? []).map((t) => `${t} — safe to defer today`);
  const items = [...new Set([...baseItems, ...deferred])];

  if (loadFirst) {
    items.unshift(LOAD_FIRST_SAFE_TO_IGNORE);
  }

  if (items.length === 0) {
    return loadFirst ? LOAD_FIRST_SAFE_TO_IGNORE : existing;
  }

  return items.slice(0, 6).join("\n");
}

export type ShapeLoadFirstOutputParams = {
  response: SolenOSResponse;
  interpretation: LoadInterpretation;
  deferredDemandTitles?: readonly string[];
};

/**
 * Post-LLM shaping when loadFirstMode — burden-first, minimal action, expanded deferrals.
 */
export function shapeLoadFirstOutput(params: ShapeLoadFirstOutputParams): SolenOSResponse {
  const { response, interpretation, deferredDemandTitles } = params;
  if (!interpretation.loadFirstMode) {
    return response;
  }

  const contributorLine =
    interpretation.primaryContributors.length > 0
      ? `Held from what you shared: ${interpretation.primaryContributors.join("; ")}.`
      : "";

  const whatIsHappening = `${interpretation.burdenSummary}${contributorLine ? ` ${contributorLine}` : ""}`;

  const whatMattersNow = [
    interpretation.burdenSummary,
    contributorLine,
    "One care detail is enough for now — no multi-step plan required.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...response,
    what_is_happening: whatIsHappening,
    what_matters_now: whatMattersNow,
    what_to_ask_next: minimalAction(response.what_to_ask_next, true),
    what_can_wait: expandWhatCanWait(
      response.what_can_wait,
      deferredDemandTitles,
      true,
    ),
  };
}
