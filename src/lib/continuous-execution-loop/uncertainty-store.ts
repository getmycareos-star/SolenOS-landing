import { UNCERTAINTY_STATES } from "./contract-constants";
import type { StateDiff, UncertaintyRecord, UncertaintyState } from "./types";

const uncertaintyByCaregiver = new Map<string, Map<string, UncertaintyRecord>>();
const lastContextSnapshot = new Map<string, { event_count: number; uncertainty_count: number }>();

function createUncertaintyId(): string {
  return `unc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getUncertaintyRecords(caregiverId: string): UncertaintyRecord[] {
  const store = uncertaintyByCaregiver.get(caregiverId);
  if (!store) return [];
  return [...store.values()];
}

export function syncUncertaintyStateMachine(input: {
  caregiver_id: string;
  diff: StateDiff;
  clarification_questions: string[];
  open_labels: string[];
  invalidated_labels?: string[];
}): UncertaintyRecord[] {
  let store = uncertaintyByCaregiver.get(input.caregiver_id);
  if (!store) {
    store = new Map();
    uncertaintyByCaregiver.set(input.caregiver_id, store);
  }

  const now = new Date().toISOString();

  for (const label of input.diff.resolved_uncertainty) {
    for (const record of store.values()) {
      if (record.label === label && record.state !== "INVALIDATED") {
        record.state = "ANSWERED";
        record.updated_at = now;
      }
    }
  }

  for (const label of input.invalidated_labels ?? []) {
    for (const record of store.values()) {
      if (record.label === label) {
        record.state = "INVALIDATED";
        record.updated_at = now;
      }
    }
  }

  for (const label of input.clarification_questions) {
    const existing = [...store.values()].find((r) => r.label === label && r.state !== "INVALIDATED");
    if (existing) {
      if (existing.state === "OPEN") {
        existing.state = "ASKED";
        existing.updated_at = now;
      }
    } else {
      const id = createUncertaintyId();
      store.set(id, {
        id,
        label,
        state: "ASKED",
        event_id: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  for (const label of [...new Set([...input.diff.new_uncertainty, ...input.open_labels])]) {
    const existing = [...store.values()].find((r) => r.label === label && r.state !== "INVALIDATED");
    if (!existing) {
      const id = createUncertaintyId();
      store.set(id, {
        id,
        label,
        state: "OPEN",
        event_id: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return [...store.values()];
}

export function getOpenUncertainties(caregiverId: string): string[] {
  return getUncertaintyRecords(caregiverId)
    .filter((r) => r.state === "OPEN" || r.state === "ASKED")
    .map((r) => r.label);
}

export function recordContextSnapshot(caregiverId: string, eventCount: number, uncertaintyCount: number): void {
  lastContextSnapshot.set(caregiverId, { event_count: eventCount, uncertainty_count: uncertaintyCount });
}

export function getLastContextSnapshot(caregiverId: string): {
  event_count: number;
  uncertainty_count: number;
} | null {
  return lastContextSnapshot.get(caregiverId) ?? null;
}

export function resetContinuousExecutionStore(): void {
  uncertaintyByCaregiver.clear();
  lastContextSnapshot.clear();
}

export { UNCERTAINTY_STATES };
export type { UncertaintyState };
