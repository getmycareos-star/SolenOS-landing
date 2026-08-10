export type {
  ConfidenceTag,
  EntityType,
  SourceSpan,
  ExtractedClaim,
  ValidatedClaim,
  ReconciliationResult,
  MatchedPair,
  DisagreementLog,
  AOnlyLog,
  ReconciliationMetrics,
  ExtractionRunOutput,
  ConsistencyGateInput,
  ConsistencyGateResult,
} from "./types";

export { runConsistencyGate } from "./pipeline";
export { verifySourcePointer, enforceSourcePointer, computeSourceSpanOverlap } from "./source-pointer";
export { reconcileExtractionRuns } from "./reconciliation";
export { setConsistencyLogger, getConsistencyLogger, ConsoleConsistencyLogger } from "./logging";
export {
  ClaimExtractionOutputSchema,
  CLAIM_EXTRACTION_SYSTEM_PROMPT,
} from "./claim-schema";
export { persistReconciledClaims, loadReconciledClaimsForEvidence } from "./postgres-store";
