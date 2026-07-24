import {
  DIAGNOSIS_VIOLATION_PATTERNS,
  ENGAGEMENT_VIOLATION_PATTERNS,
  INVENTED_CERTAINTY_PATTERNS,
  SAFE_ALTERNATIVES,
} from "./contract-constants";
import type { BoundaryViolation } from "./types";

export function scanTextForViolations(
  field: string,
  text: string,
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const pattern of DIAGNOSIS_VIOLATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        rule: "never_diagnose",
        field,
        matched_text: match[0],
        severity: "critical",
        remediation: "These observations may warrant medical evaluation.",
      });
    }
  }

  for (const pattern of INVENTED_CERTAINTY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        rule: "never_pretend_confidence",
        field,
        matched_text: match[0],
        severity: "high",
        remediation: "Express confidence proportional to available evidence.",
      });
    }
  }

  for (const pattern of ENGAGEMENT_VIOLATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        rule: "never_optimize_for_engagement",
        field,
        matched_text: match[0],
        severity: "medium",
        remediation: "Remove engagement-driven language.",
      });
    }
  }

  return violations;
}

export function remediateText(text: string): { text: string; remediated: boolean } {
  let result = text;
  let remediated = false;
  for (const { pattern, replacement } of SAFE_ALTERNATIVES) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      remediated = true;
    }
  }
  return { text: result, remediated };
}

export function scanAllSurfaces(
  surfaces: Record<string, string | string[]>,
): BoundaryViolation[] {
  const all: BoundaryViolation[] = [];
  for (const [field, value] of Object.entries(surfaces)) {
    const texts = Array.isArray(value) ? value : [value];
    for (const t of texts) {
      if (typeof t === "string" && t.trim()) {
        all.push(...scanTextForViolations(field, t));
      }
    }
  }
  return all;
}
