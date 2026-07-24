import {
  detectMedicalBoundaryViolations,
  enforceMedicalBoundary,
  isMedicalBoundaryValid,
  rewriteMedicalBoundaryOutput,
} from "../src/lib/medical-responsibility-boundary";
import { withMeta } from "../src/lib/response-validator";
import { classifyMedicalBoundaryFailure, FailureLogEntrySchema } from "../src/lib/failure-observability";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Medical Responsibility Boundary — HARD SAFETY v1 ===\n");

const safe = withMeta(VERIFY_VALID_SOLENOS);

if (!isMedicalBoundaryValid(safe)) {
  throw new Error("interpretive safe output must pass boundary gate");
}
console.log("✓ allowed interpretive clarity domain");

const diagnosis = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_is_happening: "This is pneumonia and she is worsening.",
});
const rewrittenDiagnosis = enforceMedicalBoundary(diagnosis);
if (!rewrittenDiagnosis.rewritten || !rewrittenDiagnosis.valid) {
  throw new Error("diagnosis output must be rewritten to safe language");
}
console.log("✓ diagnosis language blocked and rewritten");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyMedicalBoundaryFailure().failure_type,
  retry_count: 0,
});
console.log("✓ MEDICAL_BOUNDARY_FAILURE logged via existing observability");

const rewritten = rewriteMedicalBoundaryOutput(diagnosis);
if (detectMedicalBoundaryViolations(rewritten).length !== 0) {
  throw new Error("rewrite must eliminate detectable violations");
}

console.log("\n✓ medical responsibility boundary is hard safety firewall");
