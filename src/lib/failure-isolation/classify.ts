import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import { isValidationError } from "../response-validator";
import { createIsolatedFailure, type IsolatedFailure } from "./types";

const CONVERSATIONAL_MARKERS = [
  "i'm here for you",
  "i understand how",
  "don't worry",
  "you've got this",
  "happy to help",
  "let me know if",
];

const ADVICE_LIST_MARKERS = [
  "you could also",
  "another option",
  "alternatively",
  "on the other hand",
  "you might want to",
];

const MEDICAL_INSTRUCTION_MARKERS = [
  "take this medication",
  "increase the dose",
  "stop taking",
  "prescribe",
  "diagnosis is",
];

/**
 * 3.1 MODEL FAILURE — structurally invalid LLM output.
 */
export function classifyModelFailure(
  raw: string,
  error?: unknown,
): IsolatedFailure {
  if (error instanceof SyntaxError) {
    return createIsolatedFailure("model", "invalid JSON from LLM");
  }

  if (isValidationError(error)) {
    return createIsolatedFailure("model", "output failed strict schema validation");
  }

  if (/```/.test(raw)) {
    return createIsolatedFailure("model", "markdown fences in LLM output");
  }

  return createIsolatedFailure("model", "malformed or inconsistent model output");
}

/**
 * 3.4 INPUT FAILURE — messy or empty input (acceptable noise).
 */
export function classifyInputFailure(description: string): IsolatedFailure {
  return createIsolatedFailure("input", description);
}

/**
 * 3.2 PROMPT FAILURE — valid JSON but violates transformation intent.
 * Detection only — fix by tightening system prompt, not runtime patching.
 */
export function detectPromptFailure(output: SolenOSResponse): IsolatedFailure | null {
  const combined = collectCaregiverText(output).toLowerCase();

  for (const marker of CONVERSATIONAL_MARKERS) {
    if (combined.includes(marker)) {
      return createIsolatedFailure(
        "prompt",
        "conversational tone detected in structured output",
      );
    }
  }

  for (const marker of ADVICE_LIST_MARKERS) {
    if (combined.includes(marker)) {
      return createIsolatedFailure(
        "prompt",
        "advice-list or branching options detected",
      );
    }
  }

  for (const marker of MEDICAL_INSTRUCTION_MARKERS) {
    if (combined.includes(marker)) {
      return createIsolatedFailure(
        "prompt",
        "medical instruction language detected",
      );
    }
  }

  if (!output.what_to_ask_next.trim().endsWith("?")) {
    return createIsolatedFailure(
      "prompt",
      "what_to_ask_next must include at least one clarification question",
    );
  }

  if (/\bor\b.*\bor\b/i.test(output.what_matters_now)) {
    return createIsolatedFailure(
      "prompt",
      "multiple equal-weight options in what_matters_now",
    );
  }

  return null;
}

/**
 * 3.3 UX FAILURE — structurally valid but cognitively unclear.
 * UI/presentation layer responsibility — do not patch model output.
 */
export function detectUxFailure(output: SolenOSResponse): IsolatedFailure | null {
  const MAX_FIELD_LENGTH = 320;

  for (const [field, value] of Object.entries(output)) {
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
      return createIsolatedFailure("ux", `${field} exceeds clarity length threshold`);
    }
  }

  if (
    output.what_matters_now.split(/[,;]/).filter((s) => s.trim().length > 12).length > 2
  ) {
    return createIsolatedFailure("ux", "what_matters_now lacks single-focus clarity");
  }

  return null;
}

export function classifyOutputIssues(output: SolenOSResponse): IsolatedFailure[] {
  const issues: IsolatedFailure[] = [];
  const promptIssue = detectPromptFailure(output);
  if (promptIssue) issues.push(promptIssue);
  const uxIssue = detectUxFailure(output);
  if (uxIssue) issues.push(uxIssue);
  return issues;
}
