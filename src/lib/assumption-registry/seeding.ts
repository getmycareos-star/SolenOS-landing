import type { CareProfile } from "../care-profile/types";
import type { TrackedSituation } from "../resolution-engine";
import { ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD } from "./contract-constants";
import type { AssumptionRegistryState } from "./types";
import { addAssumption, createAssumption, invalidateAssumptionsForSituation } from "./store";
import type { DetectedAssumptionSignal } from "./detectors";
import type { AssumptionInvalidationEvent } from "./types";

/**
 * Caregiver role assumptions may seed the registry — NOT merged into Care Profile identity.
 */
export function seedAssumptionsFromCareProfile(
  state: AssumptionRegistryState,
  profile?: CareProfile,
  nowMs?: number,
): AssumptionRegistryState {
  if (!profile) return state;

  let next = state;
  const roleStatements: Record<CareProfile["roleInCareGraph"], string> = {
    primary_caregiver: "Caregiver is primary decision-maker for dependent care",
    shared_caregiver: "Care responsibilities are shared among caregivers",
    secondary_caregiver: "Caregiver provides secondary support, not sole owner",
    observer: "Caregiver is observing only — limited operational authority",
  };

  next = addAssumption(
    next,
    createAssumption({
      statement: roleStatements[profile.roleInCareGraph],
      source: "system_default",
      confidence: ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD + 0.15,
      nowMs,
    }),
  );

  if (profile.workloadIntensity === "HIGH") {
    next = addAssumption(
      next,
      createAssumption({
        statement: "Caregiver workload is high — time for new tasks is limited",
        source: "inference",
        confidence: ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD,
        nowMs,
      }),
    );
  }

  return next;
}

export function seedAssumptionsFromSignals(
  state: AssumptionRegistryState,
  signals: readonly DetectedAssumptionSignal[],
  nowMs?: number,
): AssumptionRegistryState {
  let next = state;
  for (const signal of signals) {
    if (signal.confidence < ASSUMPTION_INFERENCE_CONFIDENCE_THRESHOLD && signal.source === "inference") {
      continue;
    }
    next = addAssumption(
      next,
      createAssumption({
        statement: signal.statement,
        source: signal.source,
        relatedSituationId: signal.relatedSituationId,
        confidence: signal.confidence,
        nowMs,
      }),
    );
  }
  return next;
}

/**
 * Resolution may invalidate situation-linked assumptions when situation becomes RESOLVED.
 */
export function invalidateAssumptionsForResolvedSituations(
  state: AssumptionRegistryState,
  situations: readonly TrackedSituation[],
  nowMs?: number,
): { state: AssumptionRegistryState; events: AssumptionInvalidationEvent[] } {
  const events: AssumptionInvalidationEvent[] = [];
  let next = state;

  for (const situation of situations) {
    if (situation.status !== "RESOLVED" && situation.status !== "ARCHIVED") continue;
    const result = invalidateAssumptionsForSituation(
      next,
      situation.id,
      `situation ${situation.status.toLowerCase()} — linked assumptions invalidated`,
      nowMs,
    );
    next = result.state;
    events.push(...result.events);
  }

  return { state: next, events };
}
