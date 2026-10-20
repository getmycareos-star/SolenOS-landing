/**
 * Reality Drift Detection — v1.4 gap stub.
 * Surfaces when lived reality may diverge from STATE/BELIEF; no auto-correction.
 */

export {
  REALITY_DRIFT_SIGNAL_KINDS,
  type RealityDriftSignalKind,
  type RealityDriftSignal,
  type RealityDriftDetectionInput,
  type RealityDriftDetectionResult,
} from "./types";

export { detectRealityDrift } from "./detect";
