import {
  HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD,
  LOAD_OVERLOAD_SCORE_THRESHOLD,
} from "./contract-constants";
import { isActiveResponsibilityStatus } from "./ownership";
import type {
  DemandOwnershipEval,
  Person,
  Responsibility,
  ResponsibilityLoad,
} from "./types";

/**
 * Per-person responsibility load — prevent silent overload.
 * loadScore = active + 1.5 * highPressure (flag only; no auto-reassignment).
 */
export function computeResponsibilityLoads(params: {
  persons: readonly Person[];
  responsibilities: readonly Responsibility[];
  ownershipEvals: readonly DemandOwnershipEval[];
  highPressureThreshold?: number;
}): ResponsibilityLoad[] {
  const threshold =
    params.highPressureThreshold ?? HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD;
  const pressureByDemand = new Map(
    params.ownershipEvals.map((e) => [e.demandId, e.pressureScore]),
  );

  return params.persons.map((person) => {
    const active = params.responsibilities.filter(
      (r) =>
        r.ownerId === person.id && isActiveResponsibilityStatus(r.status),
    );
    const highPressureResponsibilities = active.filter((r) => {
      const p = pressureByDemand.get(r.demandId) ?? 0;
      return p >= threshold;
    }).length;
    const activeResponsibilities = active.length;
    const loadScore =
      Math.round(
        (activeResponsibilities + highPressureResponsibilities * 1.5) * 100,
      ) / 100;
    return {
      personId: person.id,
      activeResponsibilities,
      highPressureResponsibilities,
      loadScore,
      overloaded: loadScore >= LOAD_OVERLOAD_SCORE_THRESHOLD,
    };
  });
}
