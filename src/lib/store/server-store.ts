import { createDefaultStore } from "./runtime";
import type { SolenOSStore } from "./types";

const globalForStore = globalThis as typeof globalThis & {
  __solenosStore?: SolenOSStore;
};

/** Process-local event store (v1). Replace with durable backend in production. */
export function getServerStore(): SolenOSStore {
  if (!globalForStore.__solenosStore) {
    globalForStore.__solenosStore = createDefaultStore();
  }
  return globalForStore.__solenosStore;
}

export function resetServerStore(): SolenOSStore {
  globalForStore.__solenosStore = createDefaultStore();
  return globalForStore.__solenosStore;
}
