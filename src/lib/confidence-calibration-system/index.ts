export {
  COMPLETENESS_PENALTY_PER_MISSING,
  CONFIDENCE_CALIBRATION_DEFINING_PRINCIPLE,
  CONFIDENCE_CALIBRATION_IDENTITY,
  CONFIDENCE_CALIBRATION_RULES,
  CONFIDENCE_CEILING,
  CONFIDENCE_FLOOR,
  CONFIRMATION_BOOST,
  CONTRADICTION_PENALTY,
  INFERENCE_CEILING,
  SOURCE_TYPE_WEIGHTS,
} from "./contract-constants";
export type { SourceTypeWeight } from "./contract-constants";
export type {
  CalibratedConfidence,
  CareEventConfidenceInput,
  ConfidenceCalibrationResult,
  ConfidenceFactors,
  ProcessConfidenceCalibrationInput,
} from "./types";
export { computeEventConfidence, processConfidenceCalibration } from "./pipeline";
