import { z } from "zod";
import { SolenOSOutputSchema } from "../telemetry-persistence/schema";
import { SOLENOS_RISK_LEVELS } from "../implementation-enforcement/risk-levels";
import { RELIEF_OUTCOMES, RELIEF_VALIDATION_RECORD_FIELDS } from "./contract-constants";
import { INPUT_CATEGORIES } from "./constants";

export const ReliefOutcomeSchema = z.enum(RELIEF_OUTCOMES);

export const ReliefValidationRecordSchema = z
  .object({
    interaction_id: z.string().uuid(),
    input_category: z.enum(INPUT_CATEGORIES),
    output_structured: SolenOSOutputSchema,
    structure_valid: z.boolean(),
    semantic_valid: z.boolean(),
    latency_ms: z.number().int().min(0),
    risk_level: z.enum(SOLENOS_RISK_LEVELS),
    relief_outcome: ReliefOutcomeSchema,
    requery_detected: z.boolean(),
    helpful_feedback: z.boolean().nullable(),
  })
  .strict();

export type ReliefValidationRecord = z.infer<typeof ReliefValidationRecordSchema>;

export function assertReliefValidationRecordBoundary(fields: readonly string[]): void {
  const allowed = new Set<string>([...RELIEF_VALIDATION_RECORD_FIELDS]);
  for (const field of fields) {
    if (!allowed.has(field)) {
      throw new Error(`relief validation record drift — disallowed field: ${field}`);
    }
  }
}

export const ReliefFeedbackSubmitSchema = z
  .object({
    interaction_id: z.string().uuid(),
    helpful_yes_no: z.boolean(),
    reduced_confusion_yes_no: z.boolean(),
  })
  .strict();

export type ReliefFeedbackSubmit = z.infer<typeof ReliefFeedbackSubmitSchema>;
