import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText, outputImpliesIncompleteContext } from "../solenos-fields";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import type { ContextWindowOutput } from "../context-window-strategy";
import {
  EXTERNAL_KNOWLEDGE_PATTERNS,
  GENERAL_PATTERN_LABEL,
  GUESSED_CAUSE_PATTERNS,
  INFERENCE_LANGUAGE_PATTERNS,
  INPUT_REFERENCE_MARKERS,
  type GroundingViolationCode,
} from "./constants";

function buildInputCorpus(
  input: StressNormalizedOutput,
  contextWindow?: ContextWindowOutput,
): string {
  const parts = [input.raw_input];
  if (contextWindow) {
    parts.push(contextWindow.preserved_text);
    for (const bucket of Object.values(contextWindow.structured_context)) {
      parts.push(...bucket);
    }
  }
  return parts.join("\n").toLowerCase();
}

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function tokenizeForGrounding(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5),
  );
}

function extractSuspectTerms(text: string): string[] {
  const matches: string[] = [];
  const conditionLike =
    /\b(?:pneumonia|stroke|heart attack|infection|sepsis|uti|dementia|depression|anxiety|diabetes|copd|cancer|fracture)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = conditionLike.exec(text)) !== null) {
    matches.push(match[0].toLowerCase());
  }
  return matches;
}

function inputIsIncomplete(input: StressNormalizedOutput): boolean {
  return (
    input.detected_tags.includes("INCOMPLETE_CONTEXT") ||
    input.detected_tags.includes("CONTRADICTORY_STATEMENTS")
  );
}

export function detectGroundingViolations(
  output: SolenOSResponse,
  input: StressNormalizedOutput,
  contextWindow?: ContextWindowOutput,
): GroundingViolationCode[] {
  const text = collectCaregiverText(output);
  const inputCorpus = buildInputCorpus(input, contextWindow);
  const inputTokens = tokenizeForGrounding(inputCorpus);
  const violations = new Set<GroundingViolationCode>();

  if (matchAny(text, INFERENCE_LANGUAGE_PATTERNS)) {
    violations.add("likely_statement");
  }

  if (matchAny(text, GUESSED_CAUSE_PATTERNS)) {
    violations.add("guessed_cause");
  }

  for (const term of extractSuspectTerms(text)) {
    if (!inputCorpus.includes(term) && !inputTokens.has(term)) {
      violations.add("inferred_condition");
      break;
    }
  }

  if (
    (inputIsIncomplete(input) || outputImpliesIncompleteContext(output)) &&
    !INPUT_REFERENCE_MARKERS.test(output.what_is_happening) &&
    !/\b(cannot be determined|unknown|unclear|missing|not stated|uncertain)\b/i.test(
      output.what_is_happening,
    )
  ) {
    violations.add("completed_missing_data");
  }

  if (matchAny(text, EXTERNAL_KNOWLEDGE_PATTERNS) && !GENERAL_PATTERN_LABEL.test(text)) {
    violations.add("external_knowledge_unlabeled");
  }

  if (
    inputIsIncomplete(input) &&
    /\b(is|has|was|will be|definitely|certainly)\b/i.test(output.what_is_happening) &&
    !INPUT_REFERENCE_MARKERS.test(output.what_is_happening)
  ) {
    violations.add("fact_interpretation_mix");
  }

  return [...violations];
}