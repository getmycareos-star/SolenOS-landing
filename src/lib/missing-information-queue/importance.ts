import type { MissingInformationImportance } from "./types";

/** HIGH: without it recommendations/priorities/risks may be wrong. */
const HIGH_PATTERNS: readonly RegExp[] = [
  /\bdischarge\s+date\b/i,
  /\bdosage\b|\bdose\b|\bmedication\s+(?:name|strength|schedule)\b/i,
  /\bprimary\s+caregiver\b/i,
  /\ballerg(?:y|ies)\b/i,
  /\bdiagnosis\b/i,
  /\burgency\b.*\bunknown\b|\bunknown\b.*\burgency\b/i,
  /\bwhen\s+(?:was|did).*(?:discharg|admit|start)/i,
];

/** MEDIUM: reasoning continues but accuracy suffers. */
const MEDIUM_PATTERNS: readonly RegExp[] = [
  /\bpolicy\s+number\b/i,
  /\bappointment\s+(?:location|time|date)\b/i,
  /\binsurance\s+(?:status|appeal|coverage)\b/i,
  /\bprovider\s+name\b/i,
  /\bclaim\s+(?:number|status)\b/i,
  /\bTIMEFRAME\b|\bwhen\s+did\b/i,
  /\bwho\s+(?:else\s+)?is\s+involved\b/i,
];

/** LOW: helpful not critical. */
const LOW_PATTERNS: readonly RegExp[] = [
  /\bpreferred\s+pharmacy\b/i,
  /\bcontact\s+method\b/i,
  /\bpreferred\s+(?:time|channel|language)\b/i,
];

/**
 * Classify importance for a knowledge-gap question.
 * Heuristics only — never invents tasks.
 */
export function classifyMissingInformationImportance(
  question: string,
): MissingInformationImportance {
  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(question)) return "HIGH";
  }
  for (const pattern of MEDIUM_PATTERNS) {
    if (pattern.test(question)) return "MEDIUM";
  }
  for (const pattern of LOW_PATTERNS) {
    if (pattern.test(question)) return "LOW";
  }
  if (/\b(unknown|missing|unclear|confirm|what is|when was)\b/i.test(question)) {
    return "MEDIUM";
  }
  return "LOW";
}
