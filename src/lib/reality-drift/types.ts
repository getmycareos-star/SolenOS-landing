/**
 * Reality Drift Detection — v1.4 contract stubs.
 * Detects when lived reality diverges from STATE/BELIEF without blocking runtime.
 */

export const REALITY_DRIFT_SIGNAL_KINDS = [
  "stale_assumption",
  "context_mismatch",
  "timeline_contradiction",
  "document_age_drift",
] as const;

export type RealityDriftSignalKind = (typeof REALITY_DRIFT_SIGNAL_KINDS)[number];

export type RealityDriftSignal = {
  id: string;
  situationId: string;
  kind: RealityDriftSignalKind;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  detectedAt: string;
};

export type RealityDriftDetectionInput = {
  situationId: string;
  /** Recent user input or correction text. */
  observation?: string;
  /** ISO timestamps of last STATE/BELIEF updates — stub comparison only. */
  lastStateUpdateAt?: string;
  lastBeliefUpdateAt?: string;
};

export type RealityDriftDetectionResult = {
  signals: readonly RealityDriftSignal[];
  driftDetected: boolean;
};
