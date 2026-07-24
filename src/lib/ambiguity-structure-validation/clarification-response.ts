import { buildDegradedOutput } from "../final-output-contract";
import { validateAIResponse, type SolenOSResponse } from "../response-validator";
import { MISSING_DIMENSION_QUESTIONS } from "./contract-constants";
import type { InputClarity } from "./types";
/**
 * Structured 5-field clarification response for true BLOCK cases — no LLM.
 */
export function buildStructuredClarificationResponse(clarity: InputClarity): SolenOSResponse {
  const questions = clarity.missingDimensions.map(
    (dimension) => MISSING_DIMENSION_QUESTIONS[dimension],
  );

  return validateAIResponse(
    buildDegradedOutput({
      reason: "Input lacks structure for safe interpretation.",
      questions:
        questions.length > 0
          ? questions
          : ["What is happening with care right now — in one or two sentences?"],
      unknowns: clarity.missingDimensions,
    }),
  );
}
