import type { InputMode } from "../input-classification";
import {
  hasScopeBoundaries,
  hasStakeholderContext,
  hasSubjectDefinition,
  hasSuccessCriteria,
  hasTimeframe,
  isCareDecompressionContext,
  isTrueAmbiguous,
} from "./dimensions";
import type { ClarityLevel, InputClarity, MissingDimension } from "./types";

function collectMissingDimensions(text: string): MissingDimension[] {
  const missing: MissingDimension[] = [];
  if (!hasTimeframe(text)) missing.push("TIMEFRAME");
  if (!hasSuccessCriteria(text)) missing.push("SUCCESS_CRITERIA");
  if (!hasScopeBoundaries(text)) missing.push("SCOPE_BOUNDARIES");
  if (!hasSubjectDefinition(text)) missing.push("SUBJECT_DEFINITION");
  if (!hasStakeholderContext(text)) missing.push("STAKEHOLDER_CONTEXT");
  return missing;
}

function resolveBaseClarityLevel(text: string, missingDimensions: MissingDimension[]): ClarityLevel {
  if (missingDimensions.length === 0) return "CLEAR";
  if (isTrueAmbiguous(text)) return "AMBIGUOUS";
  if (missingDimensions.length >= 4) return "AMBIGUOUS";
  return "PARTIAL";
}

/**
 * Deterministic clarity analyzer — never populates inferredIntent (forbidden).
 */
export function analyzeClarity(input: string, inputMode?: InputMode): InputClarity {
  const text = input.trim();
  const missingDimensions = collectMissingDimensions(text);
  let clarityLevel = resolveBaseClarityLevel(text, missingDimensions);

  if (clarityLevel === "AMBIGUOUS" && isCareDecompressionContext(text, inputMode)) {
    if (!isTrueAmbiguous(text)) {
      clarityLevel = "PARTIAL";
    }
  }

  return { clarityLevel, missingDimensions };
}
