import {
  FailureLogEntrySchema,
  type FailureLogEntry,
  type FailureStage,
  type FailureType,
} from "./types";

/** Ephemeral per-request collector — no persistence, no user content. */
export class FailureObservabilityCollector {
  private logs: FailureLogEntry[] = [];

  record(params: {
    stage: FailureStage;
    failure_type: FailureType;
    retry_count: number;
  }): FailureLogEntry {
    const entry = FailureLogEntrySchema.parse({
      timestamp: new Date().toISOString(),
      stage: params.stage,
      failure_type: params.failure_type,
      retry_count: params.retry_count,
    });
    this.logs.push(entry);
    return entry;
  }

  getLogs(): readonly FailureLogEntry[] {
    return [...this.logs];
  }

  hasLogs(): boolean {
    return this.logs.length > 0;
  }
}

let lastRunLogs: readonly FailureLogEntry[] = [];

/** Debug-only peek at metadata from the most recent pipeline run (no user data). */
export function peekLastFailureLogs(): readonly FailureLogEntry[] {
  return lastRunLogs;
}

export function publishLastFailureLogs(logs: readonly FailureLogEntry[]): void {
  lastRunLogs = logs;
}

export function clearLastFailureLogs(): void {
  lastRunLogs = [];
}
