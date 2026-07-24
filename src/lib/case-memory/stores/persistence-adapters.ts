import type { Case, CaseEvent, CaseMemoryPersistenceAdapter } from "../types";

/**
 * Persistence adapters — default is noop (IN-MEMORY process store is source of truth in MVP).
 * Postgres stub records intent without writing; ready for SCHEMA-ONLY tables later.
 */

const noopAdapter: CaseMemoryPersistenceAdapter = {
  status: "noop",
  async loadCase() {
    return null;
  },
  async saveCase() {
    /* noop */
  },
  async loadEvents() {
    return [];
  },
  async saveEvent() {
    /* noop */
  },
};

/** Postgres stub — does not connect; marks FUTURE persistence path. */
const postgresStubAdapter: CaseMemoryPersistenceAdapter = {
  status: "postgres_stub",
  async loadCase(_caseId: string): Promise<Case | null> {
    return null;
  },
  async saveCase(_caseEntity: Case): Promise<void> {
    /* SCHEMA-ONLY / FUTURE — no writer wired */
  },
  async loadEvents(_caseId: string): Promise<CaseEvent[]> {
    return [];
  },
  async saveEvent(_event: CaseEvent): Promise<void> {
    /* SCHEMA-ONLY / FUTURE — no writer wired */
  },
};

let activeAdapter: CaseMemoryPersistenceAdapter = noopAdapter;

export function getCaseMemoryPersistenceAdapter(): CaseMemoryPersistenceAdapter {
  return activeAdapter;
}

export function setCaseMemoryPersistenceAdapter(
  adapter: CaseMemoryPersistenceAdapter,
): void {
  activeAdapter = adapter;
}

export function useNoopCaseMemoryPersistence(): void {
  activeAdapter = noopAdapter;
}

export function usePostgresStubCaseMemoryPersistence(): void {
  activeAdapter = postgresStubAdapter;
}

/** Fire-and-forget persist after in-memory mutation — never blocks pipeline. */
export function persistCaseBestEffort(caseEntity: Case): void {
  void activeAdapter.saveCase(caseEntity).catch(() => {
    /* swallow — memory layer must not fail analyze */
  });
}

export function persistEventBestEffort(event: CaseEvent): void {
  void activeAdapter.saveEvent(event).catch(() => {
    /* swallow */
  });
}
