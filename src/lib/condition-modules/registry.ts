/**
 * Condition Module Registry — manages available condition modules.
 *
 * This is a simple registry pattern. Modules are stateless configurations
 * that influence existing SolenOS engines. They do not replace them.
 */

import type { ConditionModule, ConditionModuleId, ConditionModuleContext } from "./types";
import { DEMENTIA_MODULE } from "./dementia";

const modules = new Map<ConditionModuleId, ConditionModule>([
  ["general", {
    id: "general",
    label: "General",
    vocabulary: [],
    attention_weights: [],
    evaluation_cases: [],
    forbidden_clinical_inferences: [],
    requires_clinical_confirmation: false,
  }],
  ["dementia", DEMENTIA_MODULE],
  ["future_condition", {
    id: "future_condition",
    label: "Future Condition",
    vocabulary: [],
    attention_weights: [],
    evaluation_cases: [],
    forbidden_clinical_inferences: [],
    requires_clinical_confirmation: false,
  }],
]);

export function getConditionModule(id: ConditionModuleId): ConditionModule {
  const module = modules.get(id);
  if (!module) {
    throw new Error(`Unknown condition module: ${id}`);
  }
  return module;
}

export function listConditionModules(): ConditionModule[] {
  return Array.from(modules.values());
}

export function createConditionContext(
  careContext: ConditionModuleId,
): ConditionModuleContext {
  const module = getConditionModule(careContext);
  return {
    care_context: careContext,
    active_vocabulary: module.vocabulary,
    active_attention_weights: module.attention_weights,
    baseline_events: [],
  };
}

export function getActiveVocabularyRules(
  careContext: ConditionModuleId,
): ConditionModule["vocabulary"] {
  return getConditionModule(careContext).vocabulary;
}

export function getActiveAttentionWeights(
  careContext: ConditionModuleId,
): ConditionModule["attention_weights"] {
  return getConditionModule(careContext).attention_weights;
}

export function getForbiddenClinicalInferences(
  careContext: ConditionModuleId,
): readonly string[] {
  return getConditionModule(careContext).forbidden_clinical_inferences;
}

export function requiresClinicalConfirmation(
  careContext: ConditionModuleId,
): boolean {
  return getConditionModule(careContext).requires_clinical_confirmation;
}
