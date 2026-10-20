import type { SolenOSResponse } from "../response-validator";
import type { PipelineOutput } from "./types";
import { SOLENOS_RESPONSE_KEYS } from "./types";
import {
  gateForUI,
  isValidationError,
  validateAIResponse,
  type ValidationError,
} from "../response-validator";

export class OutputContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputContractError";
  }
}

export { isValidationError, validateAIResponse, gateForUI, type ValidationError };

/** Strict Zod gate for the full immutable contract. */
export function validateUIOutput(data: unknown): SolenOSResponse {
  return validateAIResponse(data);
}

/** Internal pipeline contract — same as validateUIOutput under MVP determinism spec. */
export function validatePipelineOutputContract(data: unknown): PipelineOutput {
  const validated = validateAIResponse(data);

  if (!data || typeof data !== "object") {
    throw new OutputContractError("Output must be an object");
  }

  const extra = Object.keys(data as Record<string, unknown>).filter(
    (k) => !SOLENOS_RESPONSE_KEYS.includes(k as keyof SolenOSResponse),
  );
  if (extra.length > 0) {
    throw new OutputContractError(`Extra fields not allowed: ${extra.join(", ")}`);
  }

  return validated;
}

/** @deprecated Use validatePipelineOutputContract or validateUIOutput. */
export function validateOutput(data: unknown): PipelineOutput {
  return validatePipelineOutputContract(data);
}

export function formatOutputJson(output: SolenOSResponse | PipelineOutput): string {
  return JSON.stringify(output, null, 2);
}

export { SOLENOS_RESPONSE_KEYS, RISK_LEVELS } from "./types";
