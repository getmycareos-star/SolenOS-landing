export type {
  ConditionModuleId,
  VocabularyRule,
  AttentionWeightRule,
  EvaluationCase,
  ConditionModule,
  ConditionModuleContext,
  AttentionWeightInput,
} from "./types";

export {
  getConditionModule,
  listConditionModules,
  createConditionContext,
  getActiveVocabularyRules,
  getActiveAttentionWeights,
  getForbiddenClinicalInferences,
  requiresClinicalConfirmation,
} from "./registry";

export {
  applyConditionAttentionWeights,
} from "./attention";

export { DEMENTIA_MODULE } from "./dementia";
