/**
 * Demand Engine (v1.5) — STATE action demands attached to Situations.
 * @see solenós-layers STATE for persistence alignment; pressure is DERIVED.
 */

export {
  DEMAND_ENGINE_IDENTITY,
  DEMAND_ENGINE_ONE_LINE_TRUTH,
  DEMAND_ENGINE_PIPELINE_POSITION,
  DEMAND_ENGINE_FORBIDDEN,
  DEMAND_STATUSES,
  DEMAND_CATEGORIES,
  PRESSURE_WEIGHTS,
  DEFAULT_SURFACE_DEMAND_COUNT,
  HIGH_PRESSURE_THRESHOLD,
} from "./contract-constants";

export type {
  Demand,
  DemandStatus,
  DemandCategory,
  DemandGenerationSeed,
  DemandEngineOutput,
  DemandEngineGuaranteeResult,
  DemandEngineLayerPayload,
  DemandEngineLayerResult,
} from "./types";

export { computePressureScore, clampScore100, withPressureScore } from "./pressure";

export {
  generateDemandsFromSituation,
  generateDemandsFromSituations,
} from "./generate";

export {
  resetDemandStore,
  listDemands,
  listActiveDemands,
  getDemand,
  upsertDemand,
  mergeGeneratedDemands,
  replaceDemands,
  transitionDemandStatus,
  canTransitionDemand,
} from "./store";

export {
  rankDemandsByPressure,
  isActiveDemandStatus,
  buildDemandEngineOutput,
  countHighPressureDemands,
  selectTopPressureDemands,
} from "./rank";

export {
  processDemandEngineLayer,
  runDemandEngineGuarantee,
  toDemandEngineLayerPayload,
  formatDemandEngineObservation,
  type ProcessDemandEngineParams,
} from "./process";
