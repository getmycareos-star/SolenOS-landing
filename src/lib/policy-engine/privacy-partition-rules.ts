import { ATTRIBUTION_LEAKAGE_PATTERNS } from "./contract-constants";

export function scanAttributionLeakage(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of ATTRIBUTION_LEAKAGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) hits.push(match[0]);
  }
  return hits;
}

export function sanitizeAttributionLeakage(text: string): string {
  let sanitized = text;
  for (const pattern of ATTRIBUTION_LEAKAGE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[shared care observation]");
  }
  return sanitized;
}

export function validatePrivacyPartition(
  surfaces: Record<string, string | string[]>,
): { passed: boolean; violations: string[]; sanitized: Record<string, string | string[]> } {
  const violations: string[] = [];
  const sanitized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(surfaces)) {
    const texts = Array.isArray(value) ? value : [value];
    const cleaned: string[] = [];
    for (const text of texts) {
      const leaks = scanAttributionLeakage(text);
      violations.push(...leaks);
      cleaned.push(leaks.length > 0 ? sanitizeAttributionLeakage(text) : text);
    }
    sanitized[key] = Array.isArray(value) ? cleaned : cleaned[0] ?? "";
  }

  return {
    passed: violations.length === 0,
    violations: [...new Set(violations)],
    sanitized,
  };
}
