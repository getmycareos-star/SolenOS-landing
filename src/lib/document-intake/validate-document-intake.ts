import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import type {
  DocumentIntakeOutput,
  DocumentIntakeValidationResult,
  DocumentIntakeViolationCode,
} from "./types";

const DOMAIN_AUTHORITY_PATTERNS = [
  /\b(you are eligible|is eligible for|approved for coverage|claim (?:is )?approved|legally valid|legally binding)\b/i,
  /\b(diagnosed with|this confirms the diagnosis|medical diagnosis is)\b/i,
  /\b(will be covered|guaranteed coverage|insurance will pay)\b/i,
  /\b(the intent (?:of|is)|institution meant|they intended to)\b/i,
  /\b(professional interpretation|expert conclusion|authoritative meaning)\b/i,
] as const;

const RECONCILIATION_PATTERNS = [
  /\b(the correct document|actually shows|contradiction (?:is )?resolved|one document is wrong|the true version)\b/i,
  /\b(deduplicated|merged meaning|reconciled the documents)\b/i,
] as const;

function collectText(output: SolenOSResponse): string {
  return collectCaregiverText(output);
}

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Section 12 — document intake compliance on SolenOS output (no domain authority). */
export function validateDocumentIntakeCompliance(
  output: SolenOSResponse,
  intake: DocumentIntakeOutput,
): DocumentIntakeValidationResult {
  if (!intake.is_document_input) {
    return { valid: true, violations: [] };
  }

  const text = collectText(output);
  const violations = new Set<DocumentIntakeViolationCode>();

  if (matchAny(text, DOMAIN_AUTHORITY_PATTERNS)) {
    violations.add("domain_authority_implied");
  }

  if (
    /\b(eligible|eligibility|approved|denied coverage)\b/i.test(text) &&
    !/\b(input states|document states|listed as|requests)\b/i.test(text)
  ) {
    violations.add("eligibility_interpretation");
  }

  if (/\b(the (?:letter|document|notice) means|institutional intent|purpose is to)\b/i.test(text)) {
    violations.add("inferred_institutional_meaning");
  }

  if (intake.document_count > 1 && matchAny(text, RECONCILIATION_PATTERNS)) {
    violations.add("contradiction_reconciled");
  }

  if (intake.document_count > 1 && /\b(single document|combined document|merged into one)\b/i.test(text)) {
    violations.add("document_boundary_collapsed");
  }

  return { valid: violations.size === 0, violations: [...violations] };
}

export function isDocumentIntakeValid(
  output: SolenOSResponse,
  intake: DocumentIntakeOutput,
): boolean {
  return validateDocumentIntakeCompliance(output, intake).valid;
}
