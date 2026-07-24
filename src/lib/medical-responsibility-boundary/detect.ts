import type { SolenOSResponse } from "../response-validator";
import { collectCaregiverText } from "../solenos-fields";
import {  CLINICAL_AUTHORITY_PATTERNS,
  DIAGNOSIS_PATTERNS,
  DIAGNOSTIC_CERTAINTY_PATTERNS,
  MEDICATION_INSTRUCTION_PATTERNS,
  type MedicalBoundaryViolationCode,
  TREATMENT_PATTERNS,
} from "./constants";

function collectFieldText(output: SolenOSResponse): string[] {
  return [collectCaregiverText(output)];
}
function matchCategory(
  text: string,
  patterns: readonly RegExp[],
  code: MedicalBoundaryViolationCode,
  found: Set<MedicalBoundaryViolationCode>,
): void {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      found.add(code);
      return;
    }
  }
}

export function detectMedicalBoundaryViolations(
  output: SolenOSResponse,
): MedicalBoundaryViolationCode[] {
  const combined = collectFieldText(output).join("\n");
  const found = new Set<MedicalBoundaryViolationCode>();

  matchCategory(combined, DIAGNOSIS_PATTERNS, "diagnosis_language", found);
  matchCategory(combined, TREATMENT_PATTERNS, "treatment_recommendation", found);
  matchCategory(combined, MEDICATION_INSTRUCTION_PATTERNS, "medication_instruction", found);
  matchCategory(combined, CLINICAL_AUTHORITY_PATTERNS, "clinical_authority_override", found);
  matchCategory(combined, DIAGNOSTIC_CERTAINTY_PATTERNS, "diagnostic_certainty", found);

  return [...found];
}

export function isMedicalBoundaryValid(output: SolenOSResponse): boolean {
  return detectMedicalBoundaryViolations(output).length === 0;
}
