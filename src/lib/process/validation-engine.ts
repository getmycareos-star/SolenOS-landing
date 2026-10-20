import type { PipelineOutput } from "../output-contract/types";
import {
  OutputContractError,
  validatePipelineOutputContract,
} from "../output-contract/validate";
import type { DecisionState, SignalVector } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  confidence_adjustment: number;
}

function hasSignalOverlap(raw: string, text: string): boolean {
  const words = raw
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4);
  const haystack = text.toLowerCase();
  return words.some((w) => haystack.includes(w));
}

export function validatePipelineOutput(
  output: PipelineOutput,
  raw: string,
  signals: SignalVector,
  decision: DecisionState,
): ValidationResult {
  const errors: string[] = [];
  let confidence_adjustment = 0;

  try {
    validatePipelineOutputContract(output);
  } catch (e) {
    errors.push(e instanceof OutputContractError ? e.message : "schema invalid");
  }

  if (output.what_is_happening.length > 25 && !hasSignalOverlap(raw, output.what_is_happening)) {
    errors.push("what_is_happening not traceable to input");
    confidence_adjustment -= 0.15;
  }

  const riskMap: Record<string, string[]> = {
    high: ["RED"],
    medium: ["ORANGE", "YELLOW"],
    low: ["GREEN"],
  };

  const allowed = riskMap[output.risk_level] ?? [];
  if (!allowed.includes(decision.risk_level)) {
    errors.push("risk inconsistency between decision and output");
    confidence_adjustment -= 0.2;
  }

  if (!output.what_to_ask_next.trim().includes("?")) {
    errors.push("what_to_ask_next must include a question");
  }

  return {
    valid: errors.length === 0,
    errors,
    confidence_adjustment,
  };
}
