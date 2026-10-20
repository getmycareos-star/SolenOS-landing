/**
 * Care Reality State public exports.
 *
 * Client-safe: contract-constants, types, disclosure helpers.
 * Server-only: re-exported from process (node:fs) — do not import this barrel from client UI.
 * Prefer `care-reality-state/disclosure` or `care-reality-state/types` from client modules.
 */

export {
  CARE_REALITY_STATE_IDENTITY,
  CARE_REALITY_STATE_PURPOSE,
  CARE_REALITY_STATE_CHAIN,
  CARE_REALITY_DISCLOSURE_STAGES,
  CARE_REALITY_INTERNAL_QUESTION,
  CARE_REALITY_FORBIDDEN_INTERNAL_QUESTION,
  CARE_REALITY_STATE_NEVER,
  DISCLOSURE_SECTIONS_BY_STAGE,
  COGNITIVE_LOAD_PRIMARY_QUESTIONS,
} from "./contract-constants";
export type {
  CareRealityState,
  CareRealityDisclosureStage,
  ResponseEvolutionEvaluation,
  UpdateCareRealityStateInput,
} from "./types";
export type { DisclosurePlan } from "./disclosure";
export {
  disclosureStageFor,
  evaluateResponseEvolution,
  buildDisclosurePlan,
  primaryScreenQuestionFor,
} from "./disclosure";
export {
  getCareRealityState,
  updateCareRealityState,
  clearCareRealityState,
  resetCareRealityStateStore,
  clearCareRealityStateMemoryCache,
  projectDisclosureFromState,
} from "./process";
