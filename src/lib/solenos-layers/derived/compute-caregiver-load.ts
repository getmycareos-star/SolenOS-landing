/**
 * DERIVED — Caregiver Load Index over STATE (demands/situations) + BELIEF (uncertainty).
 * Thin re-export of caregiver-load-index; never a persistent engine.
 */

export {
  computeCaregiverLoad,
  classifyLoadState,
  surfaceLimitForState,
  normalizeLoadScore,
  computeRawLoadScore,
  type CaregiverLoad,
  type CaregiverLoadInputs,
  type CaregiverLoadState,
} from "../../caregiver-load-index";
