/**
 * Post-Care Insight Signal — observational label only (NOT a system mode).
 * SoT: verify:post-care-insight · contract-constants.ts
 */

export {
  POST_CARE_INSIGHT_BOUNDARY,
  POST_CARE_INSIGHT_ONE_LINE_TRUTH,
  CARE_CONTEXT_STATES,
  POST_CARE_INSIGHT_ANTI_DRIFT_RULES,
  POST_CARE_INSIGHT_FORBIDDEN_USES,
  POST_CARE_OBSERVATION_TAG_PREFIX,
  POST_CARE_LOW_CONFIDENCE_THRESHOLD,
  type CareContextState,
} from "./contract-constants";

export { CareContextStateResultSchema, assertClassifierOutputBoundary } from "./schema";
export type { CareContextStateResult } from "./schema";

export { classifyCareContextState } from "./classify";
export { applyPostCareToneAdjustment } from "./tone-adjustment";
export { POST_CARE_SIGNALS, ACTIVE_CARE_SIGNALS } from "./signals";

import {
  POST_CARE_INSIGHT_ANTI_DRIFT_RULES,
  POST_CARE_OBSERVATION_TAG_PREFIX,
  type CareContextState,
} from "./contract-constants";

/** Engineering decision filter — observing state must not become routing. */
export function assertObservationOnly(context: {
  usesForRouting?: boolean;
  createsSystemMode?: boolean;
  changesUx?: boolean;
}): void {
  if (context.usesForRouting || context.createsSystemMode || context.changesUx) {
    throw new Error(
      `post-care-insight anti-drift: ${POST_CARE_INSIGHT_ANTI_DRIFT_RULES[0]}`,
    );
  }
}

/** Telemetry observation tag — never caregiver-facing chrome. */
export function formatCareContextObservation(state: CareContextState): string {
  return `OBSERVATION: ${POST_CARE_OBSERVATION_TAG_PREFIX}${state}`;
}
