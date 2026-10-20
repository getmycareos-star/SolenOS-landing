import {
  PERSISTENCE_TRIGGER_IDS,
  type PersistenceTriggerId,
} from "./contract-constants";
import { activePersistenceTriggers, buildPersistenceSignals } from "./persistence-signals";
import type { BuildPersistenceSignalsParams } from "./persistence-signals";
import type { IdentityContinuityState, PersistenceSignals } from "./types";

/**
 * Value must be produced before persistence is evaluated.
 * ANY strict trigger true → persistence required.
 */
export function requiresPersistence(
  signals: PersistenceSignals,
  identityState: Pick<IdentityContinuityState, "mode">,
): boolean {
  if (identityState.mode === "persistent") {
    return false;
  }

  if (!signals.care_decision_generated) {
    return false;
  }

  const active = activePersistenceTriggers(signals);
  return active.length > 0;
}

export function toPersistenceTriggerIds(
  signals: PersistenceSignals,
): PersistenceTriggerId[] {
  const active = activePersistenceTriggers(signals);
  return PERSISTENCE_TRIGGER_IDS.filter((id) =>
    active.includes(id as keyof PersistenceSignals),
  );
}

export function evaluateRequiresPersistence(
  params: BuildPersistenceSignalsParams & {
    identityState: Pick<IdentityContinuityState, "mode">;
  },
): { signals: PersistenceSignals; required: boolean; triggerIds: PersistenceTriggerId[] } {
  const signals = buildPersistenceSignals(params);
  const required = requiresPersistence(signals, params.identityState);
  return {
    signals,
    required,
    triggerIds: required ? toPersistenceTriggerIds(signals) : [],
  };
}

export { buildPersistenceSignals, activePersistenceTriggers };
