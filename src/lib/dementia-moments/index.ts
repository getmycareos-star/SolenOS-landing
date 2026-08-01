/**
 * Dementia Moments — ranked moment detection for dementia caregiving situations.
 *
 * The 5 ranked moments where SolenOS creates unique value:
 * 1. New behavior change (Change Report)
 * 2. Doctor appointment (Clinician Brief)
 * 3. Hospital discharge (Transition Context)
 * 4. New caregiver starts (Care Context Summary)
 * 5. Sibling disagreement (Shared Understanding)
 *
 * "SolenOS is not building another dementia app.
 *  It is building the memory and intelligence layer for families
 *  navigating a changing human life."
 */

export {
  detectDementiaMoments,
  mapExistingEvaluationToMoment,
} from "./detect";

export {
  MOMENT_CONFIGS,
  type DementiaMomentType,
  type DementiaMomentResult,
  type DetectedMoment,
  type MomentConfig,
  type MomentConfidence,
} from "./types";

