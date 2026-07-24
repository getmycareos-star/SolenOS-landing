import { DEFAULT_MISSING_INFORMATION_EXPIRATION_DAYS } from "./contract-constants";
import type {
  MissingInformationQueuePolicy,
  MissingInformationQueueState,
} from "./types";

export function createDefaultMissingInformationPolicy(): MissingInformationQueuePolicy {
  return {
    expirationDays: DEFAULT_MISSING_INFORMATION_EXPIRATION_DAYS,
  };
}

export function createDefaultMissingInformationQueueState(
  userId: string,
  policy?: Partial<MissingInformationQueuePolicy>,
): MissingInformationQueueState {
  const base = createDefaultMissingInformationPolicy();
  return {
    userId,
    items: [],
    policy: {
      expirationDays: policy?.expirationDays ?? base.expirationDays,
    },
  };
}
