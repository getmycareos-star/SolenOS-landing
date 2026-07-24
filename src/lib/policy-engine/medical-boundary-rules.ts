import {
  MEDICAL_ADVICE_REQUEST_PATTERNS,
  MEDICAL_BOUNDARY_PATTERNS,
  MEDICAL_BOUNDARY_SAFE_ALTERNATIVES,
} from "./contract-constants";

export function detectMedicalAdviceRequest(rawInput: string): boolean {
  return MEDICAL_ADVICE_REQUEST_PATTERNS.some((p) => p.test(rawInput));
}

export function scanMedicalBoundaryViolations(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of MEDICAL_BOUNDARY_PATTERNS) {
    const match = text.match(pattern);
    if (match) hits.push(match[0]);
  }
  return hits;
}

export function sanitizeMedicalBoundary(text: string): string {
  let sanitized = text;
  for (const pattern of MEDICAL_BOUNDARY_PATTERNS) {
    sanitized = sanitized.replace(pattern, MEDICAL_BOUNDARY_SAFE_ALTERNATIVES.diagnosis);
  }
  return sanitized;
}

export function filterClarificationForMedicalBoundary(
  questions: import("../clarification-engine/types").ClarificationQuestion[],
): {
  filtered: import("../clarification-engine/types").ClarificationQuestion[];
  removed: number;
  violations: string[];
} {
  const violations: string[] = [];
  const filtered = questions.filter((q) => {
    const boundaryHits = scanMedicalBoundaryViolations(q.question);
    if (boundaryHits.length > 0) {
      violations.push(...boundaryHits);
      return false;
    }
    const adviceRequest = detectMedicalAdviceRequest(q.question);
    if (adviceRequest) {
      violations.push("medical_advice_request_in_clarification");
      return false;
    }
    return true;
  });
  return { filtered, removed: questions.length - filtered.length, violations };
}
