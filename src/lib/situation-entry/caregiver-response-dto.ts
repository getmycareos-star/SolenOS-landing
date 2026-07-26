/**
 * Caregiver-facing SituationResponse projection — Input Reality / Evidence Visibility.
 *
 * Product truth path (ADR-022, product-truth-path.md):
 * - Caregiver copy = `composeCaregiverResponse` → `buildLivingCareRecordResponse` → panel
 * - Pipeline `final_output` = INTERNAL compile (arbitration, search redirect, ops) — never caregiver product
 *
 * @see docs/17-canonical-architecture/product-truth-path.md
 */

import type { SituationResponse } from "./types";

/** Fields stripped from caregiver JSON — internal compile / ops only. */
export const CAREGIVER_INTERNAL_PIPELINE_FIELDS = [
  "final_output",
  "architectural_boundaries_layer",
  "forbidden_build_zone_layer",
  "priority_resolution_layer",
  "trust_provenance_layer",
  "failure_resilience_layer",
  "success_model_layer",
  "dare",
  "integrity_summary",
  "priority_layer",
  "memory_layer",
] as const;

export type CaregiverInternalPipelineField =
  (typeof CAREGIVER_INTERNAL_PIPELINE_FIELDS)[number];

/** Allowed keys on `/api/situation` caregiver responses — no internal compile. */
export const CAREGIVER_SITUATION_KEYS = [
  "what_i_understood",
  "what_is_uncertain",
  "what_needs_clarification",
  "what_will_be_tracked",
  "what_changed",
  "what_merged_or_split",
  "events_created",
  "context",
  "is_first_situation",
  "document_events_count",
  "timeline_views",
  "care_key",
  "active_care_situation",
  "active_care_situation_turn",
  "active_situations",
  "ui_situations",
  "care_situation_groups",
  "resolution_engine_layer",
  "mvp_surface_area_layer",
  "adoption_wedge_layer",
  "entry_behavior_layer",
  /**
   * Server-composed caregiver response — primary source for UI rendering.
   * Client falls back to client composition only when this is absent (offline/dev).
   */
  "composed_response",
] as const;

export type CaregiverSituationKey = (typeof CAREGIVER_SITUATION_KEYS)[number];

export type CaregiverSituationResponse = Partial<
  Pick<SituationResponse, CaregiverSituationKey>
> & {
  care_key?: string;
  policy_engine_layer?: {
    consent_required: boolean;
    ingestion?: {
      allowed?: boolean;
      blocked_reason?: string | null;
    };
  };
};

/** Regression guard — caregiver DTO must never expose internal compile. */
export function assertCaregiverDtoExcludesInternalCompile(
  dto: Record<string, unknown>,
  label = "caregiver situation DTO",
): void {
  for (const key of CAREGIVER_INTERNAL_PIPELINE_FIELDS) {
    if (key in dto && dto[key] !== undefined) {
      throw new Error(`${label} must not expose internal field "${key}"`);
    }
  }
}

/**
 * Project pipeline result to caregiver JSON — no reasoning_chains, confidence %,
 * engine-layer dumps, or `final_output`.
 */
export function toCaregiverSituationResponse(
  result: SituationResponse,
): CaregiverSituationResponse {
  const out: Record<string, unknown> = {};
  for (const key of CAREGIVER_SITUATION_KEYS) {
    const value = result[key as CaregiverSituationKey];
    if (value !== undefined) out[key] = value;
  }

  // Consent soft-note only — never full policy engine dump.
  const policy = result.policy_engine_layer as
    | {
        consent_required?: boolean;
        ingestion?: { allowed?: boolean; blocked_reason?: string | null };
      }
    | undefined;
  if (policy) {
    out.policy_engine_layer = {
      consent_required: Boolean(policy.consent_required),
      ingestion: policy.ingestion
        ? {
            allowed: policy.ingestion.allowed,
            blocked_reason: policy.ingestion.blocked_reason ?? null,
          }
        : undefined,
    };
  }

  assertCaregiverDtoExcludesInternalCompile(out, "toCaregiverSituationResponse");
  return out as CaregiverSituationResponse;
}
