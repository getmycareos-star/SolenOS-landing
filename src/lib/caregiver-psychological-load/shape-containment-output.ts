import type { SolenOSResponse } from "../output-contract";
import { ACUTE_BURNOUT_GROUNDING_MESSAGE } from "./contract-constants";
import type { HighSignalStressPatternResult } from "./types";

const CONTAINMENT_MINIMAL_ACTION =
  "One steady care detail is enough for now — no care plan required in this moment.";

const CONTAINMENT_SAFE_TO_IGNORE =
  "Multi-step care plans, symptom tracking, medical advice tasks, and non-urgent scheduling can all wait today.";

function expandWhatCanWait(
  existing: string,
  deferredTitles: readonly string[] | undefined,
): string {
  const baseItems = existing
    .split(/\n|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const deferred = (deferredTitles ?? []).map((t) => `${t} — safe to defer today`);
  const items = [CONTAINMENT_SAFE_TO_IGNORE, ...new Set([...baseItems, ...deferred])];
  return items.slice(0, 6).join("\n");
}

export type ShapeContainmentOutputParams = {
  response: SolenOSResponse;
  highSignalStress: HighSignalStressPatternResult;
  deferredDemandTitles?: readonly string[];
};

/**
 * Post-LLM output enforcement when Acute Caregiver Burnout Risk State / Containment Mode.
 * Suppresses multi-step tasks and care plans; emits validation/grounding copy.
 */
export function shapeContainmentOutput(
  params: ShapeContainmentOutputParams,
): SolenOSResponse {
  if (!params.highSignalStress.acuteCaregiverBurnoutRiskState) {
    return params.response;
  }

  const grounding =
    params.highSignalStress.groundingMessage ?? ACUTE_BURNOUT_GROUNDING_MESSAGE;

  return {
    ...params.response,
    what_is_happening: grounding,
    what_matters_now:
      "One steady moment is enough right now — no multi-step plan required.",
    what_to_ask_next: CONTAINMENT_MINIMAL_ACTION,
    what_can_wait: expandWhatCanWait(
      params.response.what_can_wait,
      params.deferredDemandTitles,
    ),
  };
}
