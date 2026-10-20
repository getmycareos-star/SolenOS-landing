import type { Demand } from "../demand-engine/types";
import { selectTopPressureDemands } from "../demand-engine/rank";
import { surfaceLimitForState } from "./compute";
import type { CaregiverLoad, CaregiverLoadState } from "./types";

/**
 * Decision Surface constraint by CLI state:
 * LOW → up to 4, MODERATE → 3, HIGH → 2, CRITICAL → 1 mandatory.
 */
export function constrainDemandsByLoadState(
  demands: readonly Demand[],
  loadState: CaregiverLoadState,
): Demand[] {
  const limit = surfaceLimitForState(loadState);
  return selectTopPressureDemands(demands, limit);
}

export function constrainDemandsByLoad(
  demands: readonly Demand[],
  load: CaregiverLoad,
): Demand[] {
  return constrainDemandsByLoadState(demands, load.state);
}

/** Shape decision copy: hide deferred demands under load. */
export function shapeWhatCanWaitFromDeferredDemands(
  allRanked: readonly Demand[],
  visible: readonly Demand[],
): string[] {
  const visibleIds = new Set(visible.map((d) => d.id));
  return allRanked
    .filter((d) => !visibleIds.has(d.id))
    .map((d) => d.title)
    .slice(0, 5);
}
