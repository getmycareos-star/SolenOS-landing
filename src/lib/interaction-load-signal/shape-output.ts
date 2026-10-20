import type { SolenOSResponse } from "../output-contract";
import {
  INTERACTION_SURVIVABILITY_CONTAINMENT,
  INTERACTION_SURVIVABILITY_MINIMAL_SUGGESTION,
  INTERACTION_SURVIVABILITY_NORMALIZATION,
} from "./contract-constants";
import type { InteractionLoadSignalResult } from "./types";

const PROCEDURAL_LEAD_PATTERNS = [
  /^(?:\d+\.\s*)?(?:schedule|call|organize|prepare|create a (?:list|plan|schedule))/i,
  /^step \d+/i,
  /^(?:first|next|then),?\s+(?:call|schedule|arrange)/i,
  /^care (?:plan|schedule|checklist)/i,
  /^tasks?:/i,
];

function looksProcedural(text: string): boolean {
  const trimmed = text.trim();
  return PROCEDURAL_LEAD_PATTERNS.some((p) => p.test(trimmed));
}

function containmentAction(existing: string, sleepProtection: boolean): string {
  const trimmed = existing.trim();
  if (!trimmed || looksProcedural(trimmed) || sleepProtection) {
    return INTERACTION_SURVIVABILITY_MINIMAL_SUGGESTION;
  }
  if (trimmed.length > 140) {
    return `${INTERACTION_SURVIVABILITY_MINIMAL_SUGGESTION} ${trimmed.slice(0, 80).trim()}…`;
  }
  return trimmed;
}

export type ShapeInteractionSurvivabilityParams = {
  response: SolenOSResponse;
  layer: InteractionLoadSignalResult;
  deferredDemandTitles?: readonly string[];
};

/**
 * Post-LLM shaping when outputStrategy is interaction_survivability —
 * normalization, validation, containment; no task lists or procedural steps.
 */
export function shapeInteractionSurvivabilityOutput(
  params: ShapeInteractionSurvivabilityParams,
): SolenOSResponse {
  const { response, layer, deferredDemandTitles } = params;
  if (layer.outputStrategy !== "interaction_survivability") {
    return response;
  }

  const flagSummary =
    layer.flags.length > 0
      ? ` Signals: ${layer.flags.map((f) => f.description).join("; ")}.`
      : "";

  const whatIsHappening = `${INTERACTION_SURVIVABILITY_NORMALIZATION} ${layer.systemInsight}${flagSummary}`;

  const whatMattersNow = [
    INTERACTION_SURVIVABILITY_CONTAINMENT,
    layer.sleepProtectionMode.engaged
      ? "Sleep boundary protection is active — rest comes before care tasks."
      : "Focus on closing or redirecting one interaction loop when you have capacity.",
  ].join(" ");

  const deferred = (deferredDemandTitles ?? [])
    .slice(0, 4)
    .map((t) => `${t} — safe to defer while interaction load is high`);

  const whatCanWait = [
    "Care schedules, procedural checklists, and multi-step plans can wait.",
    ...deferred,
    ...(response.what_can_wait
      ? response.what_can_wait
          .split(/\n|;\s+/)
          .map((s) => s.trim())
          .filter((s) => s && !looksProcedural(s))
          .slice(0, 2)
      : []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5)
    .join("\n");

  return {
    ...response,
    what_is_happening: whatIsHappening,
    what_matters_now: whatMattersNow,
    what_to_ask_next: containmentAction(
      response.what_to_ask_next,
      layer.sleepProtectionMode.engaged,
    ),
    what_can_wait: whatCanWait || "Non-urgent care tasks and planning can wait today.",
  };
}
