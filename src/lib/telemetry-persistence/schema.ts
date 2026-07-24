import { z } from "zod";
import { SOLENOS_LANGUAGES } from "../multilingual-execution";
import {
  TELEMETRY_FEEDBACK_REQUIRED_FIELDS,
  TELEMETRY_INTERACTION_REQUIRED_FIELDS,
  TELEMETRY_USER_DEPRECATED_FIELDS,
  TELEMETRY_USER_FORBIDDEN_FIELDS,
  TELEMETRY_USER_OPTIONAL_FIELDS,
  TELEMETRY_USER_REQUIRED_FIELDS,
} from "./contract-constants";
import { SOLENOS_RISK_LEVELS } from "../implementation-enforcement/risk-levels";
import { CAREGIVER_DEPLETION_STATES, ENVIRONMENTAL_DEPENDENCY_FLAGS } from "../caregiver-depletion-signals/contract-constants";
import { CARE_CONTEXT_STATES } from "../post-care-insight/contract-constants";
import { INPUT_CATEGORIES } from "../relief-validation/constants";
import { RELIEF_OUTCOMES } from "../relief-validation/contract-constants";

export const TelemetryUserIdSchema = z.string().uuid();

export const TelemetryUserRowSchema = z
  .object({
    id: TelemetryUserIdSchema,
    created_at: z.string(),
    last_seen_at: z.string(),
    total_sessions: z.number().int().min(0),
    auth_enabled: z.boolean().default(false),
    email: z.string().email().nullable().optional(),
    password_hash: z.string().nullable().optional(),
    language_preference: z.enum(SOLENOS_LANGUAGES).default("en"),
    ui_language: z.enum(SOLENOS_LANGUAGES).default("en"),
    voice_language: z.enum(SOLENOS_LANGUAGES).default("en"),
  })
  .strict();

export type TelemetryUserRow = z.infer<typeof TelemetryUserRowSchema>;

export const DocumentEvidenceRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: TelemetryUserIdSchema,
    file_url: z.string().min(1),
    extracted_text: z.string().nullable(),
    structured_output: z.unknown().nullable(),
    created_at: z.string(),
  })
  .strict();

export type DocumentEvidenceRow = z.infer<typeof DocumentEvidenceRowSchema>;

export const InteractionContextRowSchema = z
  .object({
    id: z.string().uuid(),
    input_raw: z.string(),
    output_structured: z.unknown(),
    risk_level: z.string(),
    created_at: z.string(),
  })
  .strict();

export type InteractionContextRow = z.infer<typeof InteractionContextRowSchema>;

export const KnowledgeChunkRowSchema = z
  .object({
    id: z.string().uuid(),
    chunk: z.string(),
    category: z.string().nullable(),
    source: z.string().nullable(),
  })
  .strict();

export type KnowledgeChunkRow = z.infer<typeof KnowledgeChunkRowSchema>;

export const PolicyFactRowSchema = z
  .object({
    id: z.string().uuid(),
    category: z.string(),
    key: z.string(),
    value: z.unknown(),
    last_updated: z.string(),
  })
  .strict();

export type PolicyFactRow = z.infer<typeof PolicyFactRowSchema>;

export const SolenOSOutputSchema = z
  .object({
    what_is_happening: z.string(),
    what_matters_now: z.string(),
    what_to_ask_next: z.string(),
    risk_level: z.enum(SOLENOS_RISK_LEVELS),
    what_can_wait: z.string(),
  })
  .strict();

export const TelemetryInteractionInsertSchema = z
  .object({
    user_id: TelemetryUserIdSchema,
    input_raw: z.string().min(1),
    output_structured: SolenOSOutputSchema,
    risk_level: z.enum(SOLENOS_RISK_LEVELS),
    latency_ms: z.number().int().min(0),
    structure_valid: z.boolean(),
    semantic_valid: z.boolean(),
    input_category: z.enum(INPUT_CATEGORIES),
    relief_outcome: z.enum(RELIEF_OUTCOMES),
    requery_detected: z.boolean(),
    helpful_feedback: z.boolean().nullable(),
    relief_signal: z.number().min(0).max(1).nullable().optional(),
    helpful_yes_no: z.boolean().nullable().optional(),
    reduced_confusion_yes_no: z.boolean().nullable().optional(),
    care_context_state: z.enum(CARE_CONTEXT_STATES),
    caregiver_depletion_state: z.enum(CAREGIVER_DEPLETION_STATES),
    is_single_caregiver: z.boolean(),
    environmental_dependency_flag: z.enum(ENVIRONMENTAL_DEPENDENCY_FLAGS),
  })
  .strict();

export type TelemetryInteractionInsert = z.infer<typeof TelemetryInteractionInsertSchema>;

export const TelemetryFeedbackSubmitSchema = z
  .object({
    interaction_id: z.string().uuid(),
    helpful_yes_no: z.boolean(),
    reduced_confusion_yes_no: z.boolean(),
    /** Durable care key — enables one-turn load/containment after confusion feedback only. */
    care_key: z.string().min(1).optional(),
  })
  .strict();

export type TelemetryFeedbackSubmit = z.infer<typeof TelemetryFeedbackSubmitSchema>;

export const GroundingContextPackageSchema = z
  .object({
    document_evidence: z.array(
      z.object({
        extracted_text: z.string().nullable(),
        structured_output: z.unknown().nullable(),
      }),
    ),
    interaction_context: z.array(
      z.object({
        input_raw: z.string(),
        risk_level: z.string(),
        created_at: z.string(),
      }),
    ),
    knowledge_chunks: z.array(
      z.object({
        chunk: z.string(),
        category: z.string().nullable(),
        source: z.string().nullable(),
      }),
    ),
    policy_facts: z.array(
      z.object({
        category: z.string(),
        key: z.string(),
        value: z.unknown(),
      }),
    ),
    memory_influence_envelope: z
      .object({
        compositeInfluence: z.number(),
        hints: z.array(z.string()),
      })
      .optional(),
  })
  .strict();

export type GroundingContextPackage = z.infer<typeof GroundingContextPackageSchema>;

export const TelemetryAnalyzeRequestExtensionSchema = z.object({
  telemetry_user_id: TelemetryUserIdSchema.optional(),
  prior_input_raw: z.string().optional(),
});

export const TELEMETRY_RESPONSE_HEADERS = {
  userId: "x-solenos-telemetry-user-id",
  interactionId: "x-solenos-telemetry-interaction-id",
} as const;

export function assertUserSchemaBoundary(columns: readonly string[]): void {
  const allowed = new Set<string>([
    ...TELEMETRY_USER_REQUIRED_FIELDS,
    ...TELEMETRY_USER_OPTIONAL_FIELDS,
    ...TELEMETRY_USER_DEPRECATED_FIELDS,
  ]);
  for (const column of columns) {
    if (TELEMETRY_USER_FORBIDDEN_FIELDS.includes(column as never)) {
      throw new Error(`forbidden user column: ${column}`);
    }
    if (!allowed.has(column)) {
      throw new Error(`user schema drift — disallowed column: ${column}`);
    }
  }
}

export function assertInteractionSchemaBoundary(fields: readonly string[]): void {
  const allowed = new Set<string>([
    ...TELEMETRY_INTERACTION_REQUIRED_FIELDS,
    "id",
    "created_at",
  ]);
  for (const field of fields) {
    if (!allowed.has(field)) {
      throw new Error(`interaction schema drift — disallowed field: ${field}`);
    }
  }
}

export function assertFeedbackSchemaBoundary(fields: readonly string[]): void {
  const allowed = new Set<string>([
    ...TELEMETRY_FEEDBACK_REQUIRED_FIELDS,
    "id",
    "created_at",
    "user_id",
  ]);
  for (const field of fields) {
    if (!allowed.has(field)) {
      throw new Error(`feedback schema drift — disallowed field: ${field}`);
    }
  }
}
