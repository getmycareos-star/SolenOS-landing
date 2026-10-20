import { z } from "zod";
import type { SolenOSResponse } from "../response-validator";

export const FAILURE_STAGES = ["prompt", "model", "zod", "postprocess"] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

export const FAILURE_TYPES = [
  "PROMPT_FAILURE",
  "MODEL_STRUCTURE_FAILURE",
  "ZOD_VALIDATION_FAILURE",
  "OVERLOAD_FAILURE",
  "INFERENCE_INCONSISTENCY_FAILURE",
  "CONSISTENCY_FAILURE",
  "PROMPT_REGRESSION_FAILURE",
  "STRUCTURE_DRIFT_DETECTED",
  "PRIORITY_DRIFT_DETECTED",
  "INTERPRETATION_DRIFT_DETECTED",
  "MEDICAL_BOUNDARY_FAILURE",
  "EPISTEMIC_SAFETY_FAILURE",
  "GROUNDING_VALIDATION_FAILURE",
  "UNKNOWN_STATE_FAILURE",
  "EMOTIONAL_STABILIZATION_FAILURE",
  "DOCUMENT_INTAKE_FAILURE",
  "CALIBRATED_UNCERTAINTY_FAILURE",
  "COGNITIVE_CLARITY_FAILURE",
  "URGENCY_ESCALATION_FAILURE",
  "SAFETY_OVERRIDE_FAILURE",
  "NON_CONVERSATIONAL_FAILURE",
  "EPISODIC_RELIEF_FAILURE",
  "CHAOS_TO_CLARITY_FAILURE",
  "SEMANTIC_ROLE_ISOLATION_FAILURE",
  "OUTPUT_COMPRESSION_FAILURE",
  "PRESSURE_REDUCTION_FAILURE",
  "COGNITIVE_COMPRESSION_FAILURE",
  "NON_ASSISTANT_OUTPUT_FAILURE",
  "CLARITY_GATE_BLOCK",
] as const;
export type FailureType = (typeof FAILURE_TYPES)[number];

export const FailureLogEntrySchema = z
  .object({
    timestamp: z.string(),
    stage: z.enum(FAILURE_STAGES),
    failure_type: z.enum(FAILURE_TYPES),
    retry_count: z.number().int().min(0),
  })
  .strict();

export type FailureLogEntry = z.infer<typeof FailureLogEntrySchema>;

export interface OutputFingerprint {
  risk_level: SolenOSResponse["risk_level"];
  field_length_sum: number;
}

export function fingerprintOutput(output: SolenOSResponse): OutputFingerprint {
  return {
    risk_level: output.risk_level,
    field_length_sum:
      output.what_is_happening.length +
      output.what_matters_now.length +
      output.what_to_ask_next.length +
      output.what_can_wait.length,
  };
}

export function fingerprintsDiverge(
  a: OutputFingerprint,
  b: OutputFingerprint,
): boolean {
  return (
    a.risk_level !== b.risk_level ||
    Math.abs(a.field_length_sum - b.field_length_sum) > 40
  );
}
