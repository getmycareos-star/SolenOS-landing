/**
 * Caregiver Psychological Load — moral injury, identity drift, emotional validation.
 * DERIVED layer; retention-critical validation is EXPLANATION adjunct only.
 */

export {
  CAREGIVER_PSYCHOLOGICAL_LOAD_IDENTITY,
  CAREGIVER_PSYCHOLOGICAL_LOAD_ONE_LINE_TRUTH,
  CAREGIVER_PSYCHOLOGICAL_LOAD_PIPELINE_POSITION,
  CAREGIVER_PSYCHOLOGICAL_LOAD_FORBIDDEN,
  CLI_CONTAINMENT_ZONE,
  CONTAINMENT_MAX_ACTIONS,
  EMOTIONAL_VALIDATION_DEFAULT_MESSAGE,
  ACUTE_BURNOUT_GROUNDING_MESSAGE,
  HIGH_SIGNAL_STRESS_IDENTITY,
  HIGH_SIGNAL_STRESS_ONE_LINE_TRUTH,
  MORAL_INJURY_SEVERITY_ORDER,
  IDENTITY_DRIFT_LEVEL_ORDER,
  CHRONIC_CONFLICT_OPEN_THRESHOLD,
} from "./contract-constants";

export type {
  MoralInjurySeverity,
  MoralInjurySignal,
  IdentityDriftLevel,
  IdentityDriftState,
  EmotionalValidation,
  EmotionalContradictionLoop,
  ContainmentMode,
  EmotionalLoadScoreLevel,
  SleepDisruptionRisk,
  UncertaintyIndex,
  SafetyStressEnvironmentFlag,
  AcuteCaregiverBurnoutRiskState,
  HighSignalStressPatternResult,
  HighSignalStressLayerPayload,
  CaregiverPsychologicalLoadGuaranteeResult,
  CaregiverPsychologicalLoadResult,
  CaregiverPsychologicalLoadPayload,
  CaregiverPsychologicalLoadForbidden,
} from "./types";

export { detectMoralInjury, type DetectMoralInjuryParams } from "./detect-moral-injury";
export {
  detectHighSignalStressPattern,
  highSignalStressMetricBoosts,
  type DetectHighSignalStressParams,
} from "./detect-high-signal-stress";
export { detectIdentityDrift, type DetectIdentityDriftParams } from "./detect-identity-drift";
export {
  detectEmotionalContradictionLoops,
  emotionalContradictionHints,
  type DetectEmotionalContradictionParams,
} from "./detect-emotional-contradiction";
export {
  evaluateContainmentMode,
  evaluateEmotionalValidation,
  type EvaluateContainmentParams,
  type EvaluateEmotionalValidationParams,
} from "./containment-validation";
export { runCaregiverPsychologicalLoadGuarantee } from "./guarantee";
export {
  shapeContainmentOutput,
  type ShapeContainmentOutputParams,
} from "./shape-containment-output";
export {
  processCaregiverPsychologicalLoad,
  toCaregiverPsychologicalLoadPayload,
  toHighSignalStressLayerPayload,
  formatCaregiverPsychologicalLoadObservation,
  formatHighSignalStressObservation,
  type ProcessCaregiverPsychologicalLoadParams,
} from "./process";
