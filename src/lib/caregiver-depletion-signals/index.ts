import type { CaregiverDepletionSignalsResult } from "./schema";

export {
  CAREGIVER_DEPLETION_BOUNDARY,
  CAREGIVER_DEPLETION_ONE_LINE_TRUTH,
  CAREGIVER_DEPLETION_STATES,
  ENVIRONMENTAL_DEPENDENCY_FLAGS,
  CAREGIVER_DEPLETION_ANTI_DRIFT_RULES,
  CAREGIVER_DEPLETION_FORBIDDEN_USES,
  CAREGIVER_DEPLETION_OBSERVATION_TAG_PREFIX,
} from "./contract-constants";
export type {
  CaregiverDepletionState,
  EnvironmentalDependencyFlag,
} from "./contract-constants";
export {
  SLEEP_DEPRIVATION_SIGNALS,
  CONTINUOUS_CARE_LOAD_SIGNALS,
  SINGLE_CAREGIVER_SIGNALS,
  END_OF_LIFE_PRESENCE_SIGNALS,
  ENVIRONMENTAL_DEPENDENCY_SIGNALS,
} from "./signals";
export {
  CaregiverDepletionSignalsResultSchema,
  assertClassifierOutputBoundary,
} from "./schema";
export type { CaregiverDepletionSignalsResult } from "./schema";
export { classifyCaregiverDepletionSignals } from "./classify";

/**
 * Engineering decision filter — depletion signals must never drive product behavior.
 */
export function assertObservationOnly(context: {
  usesForRouting?: boolean;
  usesForUiBranching?: boolean;
  usesForSchemaChange?: boolean;
  usesForLifecycle?: boolean;
  usesForStateMachine?: boolean;
  usesForIntervention?: boolean;
}): void {
  const violations: string[] = [];
  if (context.usesForRouting) violations.push("lifecycle routing");
  if (context.usesForUiBranching) violations.push("UI branching");
  if (context.usesForSchemaChange) violations.push("output schema change");
  if (context.usesForLifecycle) violations.push("lifecycle routing");
  if (context.usesForStateMachine) violations.push("state machine");
  if (context.usesForIntervention) violations.push("intervention routing");
  if (violations.length > 0) {
    throw new Error(
      `caregiver depletion anti-drift violation — forbidden: ${violations.join(", ")}`,
    );
  }
}

export function formatCaregiverDepletionObservations(
  result: Pick<
    CaregiverDepletionSignalsResult,
    "caregiver_depletion_state" | "is_single_caregiver" | "environmental_dependency_flag"
  >,
): string[] {
  return [
    `OBSERVATION: CAREGIVER_DEPLETION_STATE: ${result.caregiver_depletion_state}`,
    `OBSERVATION: IS_SINGLE_CAREGIVER: ${result.is_single_caregiver}`,
    `OBSERVATION: ENVIRONMENTAL_DEPENDENCY: ${result.environmental_dependency_flag}`,
  ];
}
