import type { DisagreementLog, AOnlyLog } from "./types";

export interface ConsistencyLogger {
  logDisagreement(log: DisagreementLog): void;
  logAOnly(log: AOnlyLog): void;
  logBOnly(log: AOnlyLog): void;
  logExtractionRun(runId: string, success: boolean, claimCount: number, error?: string): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class ConsoleConsistencyLogger implements ConsistencyLogger {
  logDisagreement(log: DisagreementLog): void {
    console.warn("[consistency-gate] disagreement", JSON.stringify(log));
  }

  logAOnly(log: AOnlyLog): void {
    console.warn("[consistency-gate] a-only", JSON.stringify(log));
  }

  logBOnly(log: AOnlyLog): void {
    console.warn("[consistency-gate] b-only", JSON.stringify(log));
  }

  logExtractionRun(runId: string, success: boolean, claimCount: number, error?: string): void {
    console.info("[consistency-gate] extraction-run", JSON.stringify({
      run_id: runId,
      success,
      claim_count: claimCount,
      error,
      timestamp: new Date().toISOString(),
    }));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[consistency-gate] ${message}`, meta ? JSON.stringify(meta) : "");
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[consistency-gate] ${message}`, meta ? JSON.stringify(meta) : "");
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[consistency-gate] ${message}`, meta ? JSON.stringify(meta) : "");
  }
}

let globalLogger: ConsistencyLogger = new ConsoleConsistencyLogger();

export function setConsistencyLogger(logger: ConsistencyLogger): void {
  globalLogger = logger;
}

export function getConsistencyLogger(): ConsistencyLogger {
  return globalLogger;
}
