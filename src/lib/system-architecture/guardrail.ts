import {
  ARCHITECTURE_FINAL_DIRECTIVE,
  ARCHITECTURE_GUARDRAIL_QUESTION,
} from "./contract-constants";

export interface ArchitectureGuardrailInput {
  reducesCaregiverCognitiveLoad: boolean;
}

export interface ArchitectureGuardrailResult {
  passes: boolean;
  question: typeof ARCHITECTURE_GUARDRAIL_QUESTION;
  directive: typeof ARCHITECTURE_FINAL_DIRECTIVE;
}

/**
 * Architecture guardrail — reject features that do not reduce caregiver cognitive load.
 */
export function passesArchitectureGuardrail(
  input: ArchitectureGuardrailInput,
): ArchitectureGuardrailResult {
  return {
    passes: input.reducesCaregiverCognitiveLoad,
    question: ARCHITECTURE_GUARDRAIL_QUESTION,
    directive: ARCHITECTURE_FINAL_DIRECTIVE,
  };
}
