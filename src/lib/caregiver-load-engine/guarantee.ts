import { CAREGIVER_LOAD_ENGINE_FORBIDDEN } from "./contract-constants";
import type { CaregiverLoadEngineResult } from "./types";

export function runCaregiverLoadEngineGuarantee(
  result: CaregiverLoadEngineResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const { state } = result;

  if (state.scores.emotionalLoadScore < 0 || state.scores.emotionalLoadScore > 100) {
    violations.push("emotionalLoadScore out of range");
  }
  if (state.scores.dependencyLoadScore < 0 || state.scores.dependencyLoadScore > 100) {
    violations.push("dependencyLoadScore out of range");
  }
  if (state.burnout.probability < 0 || state.burnout.probability > 1) {
    violations.push("burnout probability out of range");
  }
  if (state.burdenStatements.length === 0) {
    violations.push("burden statements must not be empty");
  }
  if (state.loadFirstMode && !result.loadInterpretation.burdenSummary.trim()) {
    violations.push("loadFirstMode requires burdenSummary");
  }

  for (const _forbidden of CAREGIVER_LOAD_ENGINE_FORBIDDEN) {
    if (result.loadInterpretation.burdenSummary.match(/\b(plaque|tau|hippocamp)\b/i)) {
      violations.push("burden summary contains forbidden pathology content");
    }
  }

  return { ok: violations.length === 0, violations };
}
