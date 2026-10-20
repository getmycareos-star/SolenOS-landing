import type { SolenOSResponse } from "./response-validator";

/** String caregiver fields — strict 5-field schema. */
export const SOLENOS_STRING_FIELDS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "what_can_wait",
] as const satisfies ReadonlyArray<keyof SolenOSResponse>;

export function collectCaregiverText(output: SolenOSResponse): string {
  return SOLENOS_STRING_FIELDS.map((field) => output[field]).join("\n");
}

export function hasClarifyingQuestion(output: SolenOSResponse): boolean {
  const text = output.what_to_ask_next.trim();
  if (!text) return false;
  if (text.endsWith("?")) return true;
  return /\[ \].+\?/m.test(text);
}

/** @deprecated Use hasClarifyingQuestion */
export const hasClarifyingQuestions = hasClarifyingQuestion;

export function outputImpliesIncompleteContext(output: SolenOSResponse): boolean {
  const combined = `${output.what_is_happening} ${output.what_matters_now} ${output.what_to_ask_next}`;
  return /\b(cannot be determined|unclear|uncertain|missing|not stated|unknown|uncertainty|contradict|inconsistent|conflicting)\b/i.test(
    combined,
  );
}
