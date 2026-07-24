import { z } from "zod";

export const ClassificationTypeSchema = z.enum([
  "emergency",
  "care_update",
  "emotional_signal",
  "question",
  "document",
  "ambiguous",
]);

export const ClassificationSchema = z.object({
  type: ClassificationTypeSchema,
  confidence: z.number().min(0).max(1),
});

export const SignalVectorSchema = z.object({
  urgency_signals: z.array(z.number()),
  medical_entities: z.array(z.string()),
  emotional_intensity: z.number().min(0).max(1),
  uncertainty_markers: z.array(z.string()),
  context_entities: z.array(z.string()),
  inferred: z
    .array(z.object({ signal: z.string(), confidence: z.number().min(0).max(1) }))
    .optional(),
});

export const DecisionStateSchema = z.object({
  primary_action: z.string().min(1),
  next_question: z.string().optional(),
  priority_score: z.number().min(0).max(1),
  risk_level: z.enum(["RED", "ORANGE", "YELLOW", "GREEN"]),
  confidence: z.number().min(0).max(1).optional(),
  blocking_factor: z.string().optional(),
});

export const DecisionTraceSchema = z.object({
  classification: z.string(),
  domain: z.string(),
  priority_score: z.number(),
  confidence: z.number(),
  safe_mode: z.boolean(),
});

export const SolenOSOutputSchema = z.object({
  emotional_context: z.string(),
  what_is_happening: z.string().min(1),
  what_matters_now: z.string().min(1),
  what_to_ask_next: z.array(z.string().min(1)).min(1),
  risk_level: z.enum(["low", "medium", "high"]),
  what_can_wait: z.string().min(1),
  follow_up_items: z.array(z.string()),
  decision_trace: DecisionTraceSchema,
});

export const MemoryItemSchema = z.object({
  memory_id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  fact: z.string(),
  weight: z.number(),
  recency: z.number(),
  emotional_salience: z.number(),
  contradiction_flag: z.boolean(),
  source_event_id: z.string(),
  created_at: z.string(),
});

export const CognitiveVersionSchema = z.object({
  kernel_version: z.string(),
  reasoning_spec_version: z.string(),
  decision_engine_version: z.string(),
  risk_engine_version: z.string(),
  schema_version: z.string(),
});

export const CareEventTypeSchema = z.enum([
  "input_received",
  "classification_completed",
  "signal_extracted",
  "decision_generated",
  "risk_assessed",
  "safe_mode_triggered",
  "user_override",
]);

export const CareEventSchema = z.object({
  event_id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  type: CareEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  temporal: z.object({
    event_time: z.string(),
    processing_time: z.string(),
  }),
  cognitive_version: CognitiveVersionSchema,
  integrity: z.object({
    checksum: z.string(),
    immutable: z.literal(true),
  }),
});

export const ExecuteRequestSchema = z.object({
  input: z.string().min(1).max(10000),
  session_id: z.string().optional(),
  user_id: z.string().optional(),
  idempotency_key: z.string().optional(),
});

export const CreateSessionRequestSchema = z.object({
  user_id: z.string().optional(),
  profile: z
    .object({
      role: z.enum(["caregiver", "patient", "family", "admin"]).optional(),
      region: z.string().optional(),
    })
    .optional(),
});

export const AppendEventRequestSchema = z.object({
  session_id: z.string(),
  user_id: z.string(),
  type: CareEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export const ReplayRequestSchema = z.object({
  session_id: z.string(),
});

export type Classification = z.infer<typeof ClassificationSchema>;
export type SignalVector = z.infer<typeof SignalVectorSchema>;
export type DecisionState = z.infer<typeof DecisionStateSchema>;
export type SolenOSOutput = z.infer<typeof SolenOSOutputSchema>;
export type MemoryItem = z.infer<typeof MemoryItemSchema>;
export type CareEvent = z.infer<typeof CareEventSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues.map((e) => e.message).join("; "));
  }
  return result.data;
}
