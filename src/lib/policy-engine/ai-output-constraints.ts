import { FALSE_CERTAINTY_PATTERNS } from "./contract-constants";
import { sanitizeMedicalBoundary, scanMedicalBoundaryViolations } from "./medical-boundary-rules";
import { sanitizeAttributionLeakage, scanAttributionLeakage } from "./privacy-partition-rules";

export function softenFalseCertainty(text: string): { text: string; softened: number } {
  let result = text;
  let softened = 0;
  for (const pattern of FALSE_CERTAINTY_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, "based on available information");
      softened += 1;
    }
  }
  return { text: result, softened };
}

export function applyAIOutputConstraints(
  surfaces: Record<string, string | string[]>,
): {
  sanitized: Record<string, string | string[]>;
  violations: string[];
  sanitized_fields: string[];
  attribution_leaks_blocked: number;
  medical_boundary_violations: number;
  certainty_softened: number;
} {
  const violations: string[] = [];
  const sanitized_fields: string[] = [];
  let attribution_leaks_blocked = 0;
  let medical_boundary_violations = 0;
  let certainty_softened = 0;
  const sanitized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(surfaces)) {
    const texts = Array.isArray(value) ? value : [value];
    const cleaned: string[] = [];

    for (const text of texts) {
      let current = text;
      const attrLeaks = scanAttributionLeakage(current);
      if (attrLeaks.length > 0) {
        violations.push(...attrLeaks);
        attribution_leaks_blocked += attrLeaks.length;
        current = sanitizeAttributionLeakage(current);
        sanitized_fields.push(key);
      }

      const medViolations = scanMedicalBoundaryViolations(current);
      if (medViolations.length > 0) {
        violations.push(...medViolations);
        medical_boundary_violations += medViolations.length;
        current = sanitizeMedicalBoundary(current);
        sanitized_fields.push(key);
      }

      const softened = softenFalseCertainty(current);
      if (softened.softened > 0) {
        certainty_softened += softened.softened;
        current = softened.text;
        sanitized_fields.push(key);
      }

      cleaned.push(current);
    }

    sanitized[key] = Array.isArray(value) ? cleaned : cleaned[0] ?? "";
  }

  return {
    sanitized,
    violations: [...new Set(violations)],
    sanitized_fields: [...new Set(sanitized_fields)],
    attribution_leaks_blocked,
    medical_boundary_violations,
    certainty_softened,
  };
}
