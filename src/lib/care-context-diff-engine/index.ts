export {
  CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE,
  CARE_CONTEXT_DIFF_DESIGN_RULES,
  CARE_CONTEXT_DIFF_IDENTITY,
  CARE_CONTEXT_DIFF_SECTIONS,
  CHANGE_CATEGORIES,
} from "./contract-constants";
export type {
  CareContextDiff,
  CareContextDiffResult,
  CareContextDiffSectionKey,
  CareContextDiffSections,
  ChangeCategory,
  ProcessCareContextDiffInput,
} from "./types";
export { processCareContextDiff } from "./pipeline";
export {
  computeCareContextDiffSections,
  derivePrimaryChange,
  deriveTimeFrame,
  hasMeaningfulChange,
} from "./compute-diff";
export {
  getPriorComprehension,
  recordComprehension,
  resetCareContextDiffStore,
} from "./store";
export type { ComprehensionSnapshot } from "./store";
