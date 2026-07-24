import type { SolenOSResponse } from "../response-validator";
import type { MedicalBoundaryResult } from "./constants";
import { detectMedicalBoundaryViolations } from "./detect";
import { rewriteMedicalBoundaryOutput } from "./rewrite";

export interface MedicalBoundaryGateResult extends MedicalBoundaryResult {
  output: SolenOSResponse;
}

/**
 * Hard safety gate: detect forbidden clinical authority, rewrite, re-validate.
 * Never returns forbidden content as-is when rewrite succeeds.
 */
export function enforceMedicalBoundary(output: SolenOSResponse): MedicalBoundaryGateResult {
  const initialViolations = detectMedicalBoundaryViolations(output);
  if (initialViolations.length === 0) {
    return {
      valid: true,
      violations: [],
      rewritten: false,
      output,
    };
  }

  const rewrittenOutput = rewriteMedicalBoundaryOutput(output);
  const remainingViolations = detectMedicalBoundaryViolations(rewrittenOutput);

  return {
    valid: remainingViolations.length === 0,
    violations: remainingViolations.length > 0 ? remainingViolations : initialViolations,
    rewritten: true,
    output: rewrittenOutput,
  };
}

export function isMedicalBoundaryGateValid(output: SolenOSResponse): boolean {
  return enforceMedicalBoundary(output).valid;
}
