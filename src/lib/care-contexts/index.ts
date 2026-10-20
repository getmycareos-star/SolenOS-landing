export type { CareContextType, CareProfileExtension } from "./types";
export { CARE_CONTEXT_TYPES } from "./types";

export {
  DEMENTIA_LAYER_IDENTITY,
  DEMENTIA_LAYER_BOUNDARY,
  FINANCIAL_RISK_LABEL,
  DEMENTIA_STAGES,
  DRIVING_STATUSES,
  MEDICATION_RISK_LEVELS,
  DEFAULT_DEMENTIA_CONTEXT,
  SUNDOWNING_WARNING,
  DEMENTIA_STAGE_LABELS,
  MEDICATION_RISK_LABELS,
  DRIVING_STATUS_LABELS,
  formatSundowningWindow,
  parseDementiaContext,
  type DementiaContext,
  type DementiaStage,
  type MedicationRiskLevel,
  type DrivingStatus,
  type WanderingEvent,
  type FinancialRiskEvent,
  type SundowningWindow,
  type DementiaProfileView,
} from "./dementia";

/**
 * Client-safe care-contexts barrel.
 * Dementia is the MVP care-context extension; `future_condition` reserves scalability.
 * Persistence: `@/lib/care-contexts/dementia/server`.
 * Clinical profile SoT: `@/lib/clinical-profile`.
 */
