export {
  DEMENTIA_STAGES,
  DRIVING_STATUSES,
  MEDICATION_RISK_LEVELS,
  type DementiaStage,
  type MedicationRiskLevel,
  type DrivingStatus,
  type WanderingEvent,
  type FinancialRiskEvent,
  type SundowningWindow,
  type DementiaContext,
  type DementiaProfileView,
} from "./types";

export { DEMENTIA_LAYER_IDENTITY, DEMENTIA_LAYER_BOUNDARY, FINANCIAL_RISK_LABEL } from "./contract-constants";
export { DEFAULT_DEMENTIA_CONTEXT } from "./defaults";
export {
  parseDementiaContext,
  validateDementiaStage,
  validateMedicationRisk,
  validateDrivingStatus,
  validateSundowningWindow,
} from "./validate";
export {
  SUNDOWNING_WARNING,
  DEMENTIA_STAGE_LABELS,
  MEDICATION_RISK_LABELS,
  DRIVING_STATUS_LABELS,
  formatSundowningWindow,
} from "./display";

/**
 * Client-safe barrel.
 * Mutations / Postgres: `@/lib/care-contexts/dementia/server`.
 */
