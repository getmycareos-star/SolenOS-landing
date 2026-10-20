import type { InputMode } from "../input-classification";
import { CLARITY_CONSTRAINT_PREFIX } from "./contract-constants";
import { analyzeClarity } from "./analyze-clarity";
import type { ClarificationGateResult, InputClarity } from "./types";

export function formatClarityConstraintLine(clarity: InputClarity): string | undefined {
  if (clarity.clarityLevel === "CLEAR") return undefined;
  const missing =
    clarity.missingDimensions.length > 0
      ? ` missing=[${clarity.missingDimensions.join(",")}]`
      : "";
  return `${CLARITY_CONSTRAINT_PREFIX} ${clarity.clarityLevel}${missing}`;
}

/**
 * Pre-reasoning decision gate — BLOCK | PARTIAL | PASS.
 */
export function processInputClarityGate(
  input: string,
  inputMode?: InputMode,
): ClarificationGateResult {
  const clarity = analyzeClarity(input, inputMode);

  switch (clarity.clarityLevel) {
    case "AMBIGUOUS":
      return { action: "BLOCK", clarity };
    case "PARTIAL":
      return {
        action: "PARTIAL",
        clarity,
        constraintLine: formatClarityConstraintLine(clarity),
      };
    case "CLEAR":
      return { action: "PASS", clarity };
  }
}
