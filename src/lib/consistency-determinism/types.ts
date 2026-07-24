import { z } from "zod";
import { CANONICAL_OUTPUT_FIELD_ORDER } from "../canonical-architecture/contract";

export const SOLENOS_FIELD_ORDER = CANONICAL_OUTPUT_FIELD_ORDER;

/** @deprecated _meta removed from MVP schema — kept for legacy adapters only */
export const META_FIELD_ORDER = [
  "context_completeness",
  "missing_critical_fact",
  "confidence",
] as const;

/** @deprecated */
export const OutputMetaSchema = z
  .object({
    context_completeness: z.number().min(0).max(1),
    missing_critical_fact: z.string().nullable(),
    confidence: z.enum(["low", "medium", "high", "unknown"]),
  })
  .strict();

/** @deprecated */
export type OutputMeta = z.infer<typeof OutputMetaSchema>;

/** @deprecated Use OutputMetaSchema */
export const DecisionTraceSchema = OutputMetaSchema;

/** @deprecated Use OutputMeta */
export type DecisionTrace = OutputMeta;

/** @deprecated Use META_FIELD_ORDER */
export const DECISION_TRACE_FIELD_ORDER = META_FIELD_ORDER;

export const DETERMINISM_FAILURE_TYPES = [
  "CONSISTENCY_FAILURE",
  "STRUCTURE_DRIFT_DETECTED",
  "PRIORITY_DRIFT_DETECTED",
  "INTERPRETATION_DRIFT_DETECTED",
  "PROMPT_REGRESSION_FAILURE",
] as const;

export type DeterminismFailureType = (typeof DETERMINISM_FAILURE_TYPES)[number];

export type StructureDriftResult =
  | { ok: true }
  | { ok: false; failure_type: "STRUCTURE_DRIFT_DETECTED"; reason: string };

/** @deprecated Use StructureDriftResult */
export type StabilityCheckResult = StructureDriftResult;

export type ConsistencyCheckResult =
  | { ok: true }
  | { ok: false; failure_type: "CONSISTENCY_FAILURE" };

export type PriorityStabilityResult =
  | { ok: true }
  | { ok: false; failure_type: "PRIORITY_DRIFT_DETECTED" };

export type InterpretationStabilityResult =
  | { ok: true }
  | { ok: false; failure_type: "INTERPRETATION_DRIFT_DETECTED" };

export type PromptRegressionCheckResult =
  | { ok: true; skipped: boolean }
  | { ok: false; failure_type: "PROMPT_REGRESSION_FAILURE" };
