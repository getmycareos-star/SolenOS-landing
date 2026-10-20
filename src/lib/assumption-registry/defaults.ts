import {
  DEFAULT_ASSUMPTION_EXPIRATION_DAYS,
  DEFAULT_ASSUMPTION_STALE_DAYS,
} from "./contract-constants";
import type { AssumptionRegistryPolicy, AssumptionRegistryState } from "./types";

export function createDefaultAssumptionPolicy(): AssumptionRegistryPolicy {
  return {
    expirationDays: DEFAULT_ASSUMPTION_EXPIRATION_DAYS,
    staleDays: DEFAULT_ASSUMPTION_STALE_DAYS,
  };
}

export function createDefaultAssumptionRegistryState(
  userId: string,
  policy?: Partial<AssumptionRegistryPolicy>,
): AssumptionRegistryState {
  const base = createDefaultAssumptionPolicy();
  return {
    userId,
    assumptions: [],
    policy: {
      expirationDays: policy?.expirationDays ?? base.expirationDays,
      staleDays: policy?.staleDays ?? base.staleDays,
    },
  };
}
