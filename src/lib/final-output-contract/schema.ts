import { z } from "zod";

import {
  CANONICAL_CONFIDENCE_LEVELS,
  CANONICAL_RISK_LEVELS,
} from "./contract-constants";
import { createEmptyConfidenceState, createEmptyDecisionTrace, createEmptyTrustLayer, createEmptyTransparencyPanel } from "./degrade";
import type { FinalOutputContract, FinalOutputValidationError } from "./types";

function normalizeCanonicalRisk(value: unknown): FinalOutputContract["risk_level"] {
  if (value === "critical" || value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  return "medium";
}

function ensureFinalOutputShape(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  return {
    what_is_happening: obj.what_is_happening ?? "",
    what_matters_now: obj.what_matters_now ?? "",
    what_to_ask_next: obj.what_to_ask_next ?? "",
    risk_level: normalizeCanonicalRisk(obj.risk_level),
    what_can_wait: obj.what_can_wait ?? "",
    follow_up_items: Array.isArray(obj.follow_up_items) ? obj.follow_up_items : [],
    decision_trace:
      obj.decision_trace && typeof obj.decision_trace === "object"
        ? obj.decision_trace
        : createEmptyDecisionTrace(),
    confidence_state:
      obj.confidence_state && typeof obj.confidence_state === "object"
        ? obj.confidence_state
        : createEmptyConfidenceState(),
    trust_layer:
      obj.trust_layer && typeof obj.trust_layer === "object"
        ? obj.trust_layer
        : createEmptyTrustLayer(),
    transparency_panel:
      obj.transparency_panel && typeof obj.transparency_panel === "object"
        ? obj.transparency_panel
        : createEmptyTransparencyPanel(),
  };
}

export const DecisionTraceSchema = z
  .object({
    events: z.array(z.string()),
    assumptions: z.array(z.string()),
    unknowns: z.array(z.string()),
    evidence_sources: z.array(z.string()),
  })
  .strict();

export const ConfidenceStateSchema = z
  .object({
    overall_confidence: z.enum(CANONICAL_CONFIDENCE_LEVELS),
    completeness: z.number().min(0).max(100),
    reasoning_limits: z.array(z.string()),
  })
  .strict();

export const TrustLayerSchema = z
  .object({
    known: z.array(
      z.object({
        statement: z.string(),
        source: z.string(),
        source_type: z.enum(["care_event", "caregiver_input", "document", "care_context"]),
        source_event_id: z.string().optional(),
      }),
    ),
    assumed: z.array(
      z.object({
        statement: z.string(),
        reasoning_basis: z.string(),
        source_engine: z.string(),
      }),
    ),
    unknown: z.array(
      z.object({
        statement: z.string(),
        drives_clarification: z.boolean(),
      }),
    ),
    recency: z.object({
      last_updated_at: z.string().nullable(),
      freshness_score: z.number().min(0).max(1),
      interpretation: z.string(),
    }),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const TransparencyPanelSchema = z
  .object({
    data_used: z.object({
      care_events: z.array(z.string()),
      timeline_segments: z.array(z.string()),
      caregiver_inputs: z.array(z.string()),
    }),
    data_ignored: z.object({
      conflicting: z.array(z.string()),
      low_confidence: z.array(z.string()),
      stale_or_decayed: z.array(z.string()),
    }),
    reason_for_output: z.string().min(1),
    evidence_breakdown: z.array(
      z.object({
        conclusion: z.string(),
        evidence_type: z.enum(["observation", "inference", "external_report", "system_pattern"]),
        confidence_pct: z.number().min(0).max(100),
      }),
    ),
    confidence_scores: z.object({
      overall_pct: z.number().min(0).max(100),
      tier: z.enum(["high", "medium", "low"]),
    }),
    recency: z.object({
      last_update_at: z.string().nullable(),
      critical_event_ages: z.array(z.string()),
      decay_status: z.enum(["fresh", "aging", "stale"]),
    }),
    observed: z.array(z.string()),
    inferred: z.array(z.string()),
  })
  .strict();

export const FinalOutputContractSchema = z.preprocess(
  ensureFinalOutputShape,
  z
    .object({
      what_is_happening: z.string().min(1),
      what_matters_now: z.string().min(1),
      what_to_ask_next: z.string().min(1),
      risk_level: z.enum(CANONICAL_RISK_LEVELS),
      what_can_wait: z.string().min(1),
      follow_up_items: z.array(z.string()),
      decision_trace: DecisionTraceSchema,
      confidence_state: ConfidenceStateSchema,
      trust_layer: TrustLayerSchema,
      transparency_panel: TransparencyPanelSchema,
    })
    .strict(),
);

export function validateFinalOutput(output: unknown): FinalOutputContract {
  const result = FinalOutputContractSchema.safeParse(output);
  if (result.success) {
    return result.data;
  }
  throw {
    type: "INVALID_FINAL_OUTPUT",
    message: "Output failed strict final output contract validation",
    raw_output: output,
  } satisfies FinalOutputValidationError;
}

export function isFinalOutputValidationError(
  error: unknown,
): error is FinalOutputValidationError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as FinalOutputValidationError).type === "INVALID_FINAL_OUTPUT"
  );
}

export function extractFinalOutputPayload(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  const obj = output as Record<string, unknown>;
  if (obj.final_output && typeof obj.final_output === "object") {
    return obj.final_output;
  }
  return {
    what_is_happening: obj.what_is_happening,
    what_matters_now: obj.what_matters_now,
    what_to_ask_next: obj.what_to_ask_next,
    risk_level: obj.risk_level,
    what_can_wait: obj.what_can_wait,
    follow_up_items: obj.follow_up_items,
    decision_trace: obj.decision_trace,
    confidence_state: obj.confidence_state,
    trust_layer: obj.trust_layer,
    transparency_panel: obj.transparency_panel,
  };
}

export { ensureFinalOutputShape };
