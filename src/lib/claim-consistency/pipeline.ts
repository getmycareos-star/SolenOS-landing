import type {
  ConsistencyGateInput,
  ConsistencyGateResult,
  ReconciliationResult,
  ExtractionRunOutput,
} from "./types";
import { runParallelExtractions } from "./extraction-runner";
import { reconcileExtractionRuns } from "./reconciliation";
import { getConsistencyLogger } from "./logging";

export async function runConsistencyGate(
  input: ConsistencyGateInput,
  signal?: AbortSignal,
): Promise<ConsistencyGateResult> {
  const logger = getConsistencyLogger();
  const evidenceId = input.evidence_id;

  logger.info("starting consistency gate", { evidence_id: evidenceId });

  const { runA, runB } = await runParallelExtractions(input, signal);

  logger.logExtractionRun(runA.run_id, runA.success, runA.claims.length, runA.error);
  logger.logExtractionRun(runB.run_id, runB.success, runB.claims.length, runB.error);

  if (!runA.success && !runB.success) {
    const error = `Both extraction runs failed. Run A: ${runA.error ?? "unknown"}. Run B: ${runB.error ?? "unknown"}`;
    logger.error("both runs failed", { evidence_id: evidenceId, error });
    return {
      success: false,
      reconciliation: createEmptyReconciliation(evidenceId),
      run_a: runA,
      run_b: runB,
      error,
    };
  }

  if (!runA.success || !runB.success) {
    const failedRun = !runA.success ? "A" : "B";
    const failedError = !runA.success ? runA.error : runB.error;
    logger.error("one run failed", { evidence_id: evidenceId, failed_run: failedRun, error: failedError });
    return {
      success: false,
      reconciliation: createEmptyReconciliation(evidenceId),
      run_a: runA,
      run_b: runB,
      error: `Run ${failedRun} failed: ${failedError}. Cannot create confirmed claims with single run.`,
    };
  }

  const reconciliation = reconcileExtractionRuns(runA, runB, evidenceId);

  for (const log of reconciliation.disagreements) {
    logger.logDisagreement(log);
  }
  for (const log of reconciliation.a_only_logs) {
    logger.logAOnly(log);
  }
  for (const log of reconciliation.b_only_logs) {
    logger.logBOnly(log);
  }

  logger.info("consistency gate complete", {
    evidence_id: evidenceId,
    matched: reconciliation.metrics.matched_claims,
    a_only: reconciliation.metrics.a_only_claims,
    b_only: reconciliation.metrics.b_only_claims,
    confirmed: reconciliation.metrics.confirmed_claims,
  });

  return {
    success: true,
    reconciliation,
    run_a: runA,
    run_b: runB,
  };
}

function createEmptyReconciliation(evidenceId: string): ReconciliationResult {
  return {
    evidence_id: evidenceId,
    reconciled_claims: [],
    matched_pairs: [],
    a_only_claims: [],
    b_only_claims: [],
    disagreements: [],
    a_only_logs: [],
    b_only_logs: [],
    metrics: {
      total_extracted_claims: 0,
      matched_claims: 0,
      a_only_claims: 0,
      b_only_claims: 0,
      full_agreement_claims: 0,
      disagreement_claims: 0,
      confirmed_claims: 0,
      reported_claims: 0,
      inferred_claims: 0,
      unknown_claims: 0,
      downgrade_count: 0,
      confirmed_survival_rate: 0,
    },
  };
}
