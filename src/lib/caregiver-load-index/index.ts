/**
 * Caregiver Load Index (v1.6) — DERIVED over STATE + BELIEF.
 * Canonical companion: src/lib/solenos-layers/derived/compute-caregiver-load
 */

export {
  CAREGIVER_LOAD_INDEX_IDENTITY,
  CAREGIVER_LOAD_INDEX_ONE_LINE_TRUTH,
  CAREGIVER_LOAD_INDEX_PIPELINE_POSITION,
  CAREGIVER_LOAD_INDEX_FORBIDDEN,
  CAREGIVER_LOAD_STATES,
  LOAD_STATE_SURFACE_LIMITS,
  LOAD_SCORE_BANDS,
  LOAD_FORMULA_WEIGHTS,
} from "./contract-constants";

export type {
  CaregiverLoad,
  CaregiverLoadState,
  CaregiverLoadInputs,
  CaregiverLoadGuaranteeResult,
  CaregiverLoadLayerPayload,
  CaregiverLoadLayerResult,
} from "./types";

export {
  clampLoadScore,
  computeRawLoadScore,
  normalizeLoadScore,
  classifyLoadState,
  surfaceLimitForState,
  computeCaregiverLoad,
} from "./compute";

export {
  constrainDemandsByLoadState,
  constrainDemandsByLoad,
  shapeWhatCanWaitFromDeferredDemands,
} from "./surface";

export {
  buildCaregiverLoadInputs,
  processCaregiverLoadLayer,
  runCaregiverLoadGuarantee,
  toCaregiverLoadLayerPayload,
  formatCaregiverLoadObservation,
  selectSurfaceDemandsForLoad,
  type ProcessCaregiverLoadParams,
} from "./process";
