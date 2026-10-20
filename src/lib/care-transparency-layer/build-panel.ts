import { TRANSPARENCY_RULES } from "./contract-constants";
import type { BuildCareTransparencyInput, CareTransparencyPanel, CareTransparencyResult } from "./types";

function tierFromPct(pct: number): CareTransparencyPanel["confidence_scores"]["tier"] {
  if (pct >= 70) return "high";
  if (pct >= 45) return "medium";
  return "low";
}

function decayFromFreshness(score: number): CareTransparencyPanel["recency"]["decay_status"] {
  if (score >= 0.7) return "fresh";
  if (score >= 0.4) return "aging";
  return "stale";
}

export function buildCareTransparencyPanel(input: BuildCareTransparencyInput): CareTransparencyPanel {
  const { response } = input;
  const events = response.context.events;
  const created = response.events_created;

  const care_events = [
    ...created.map((e) => `${e.id}: ${e.extracted_type} — ${e.raw_input.slice(0, 80)}`),
    ...events.slice(-5).map((e) => `${e.id}: ${e.raw_input.slice(0, 60)}`),
  ].slice(0, 8);

  const timeline_segments =
    response.timeline_reconstruction_layer?.nodes.map(
      (n) => `${n.normalized_timestamp}: ${n.observation.slice(0, 80)}`,
    ) ?? response.care_timeline_engine_layer?.care_truth.timeline.slice(-5).map((e) => e.abstract_label) ?? [];

  const caregiver_inputs = created.map((e) => e.raw_input.slice(0, 120)).filter(Boolean);

  const conflicting =
    response.contradiction_detection_layer?.open_contradictions.map((c) => c.shared_message) ??
    response.care_timeline_engine_layer?.care_record.conflicts.map((c) => c.shared_message) ??
    [];

  const low_confidence = [
    ...(response.what_is_uncertain ?? []),
    ...(response.timeline_reconstruction_layer?.uncertainty_flags ?? []),
  ].slice(0, 5);

  const stale_or_decayed =
    response.continuity_decay_layer?.stale_items.map((s) => `${s.label} (${s.tier})`) ?? [];

  const reason_for_output =
    input.final_output_draft?.what_matters_now ??
    response.state_of_care_summary_layer?.summary.what_matters_most ??
    "Derived from current CareContext state and most recent CareEvents.";

  const evidence_breakdown: CareTransparencyPanel["evidence_breakdown"] = [];

  for (const item of response.what_i_understood.slice(0, 5)) {
    evidence_breakdown.push({
      conclusion: item.label,
      evidence_type: "observation",
      confidence_pct: 75,
    });
  }

  for (const assumed of response.trust_layer_engine_layer?.trust_layer.assumed ?? []) {
    evidence_breakdown.push({
      conclusion: assumed.statement,
      evidence_type: "inference",
      confidence_pct: Math.round((response.trust_layer_engine_layer?.trust_layer.confidence ?? 0.5) * 100),
    });
  }

  if (evidence_breakdown.length === 0 && created.length > 0) {
    evidence_breakdown.push({
      conclusion: created[0]!.raw_input.slice(0, 100),
      evidence_type: "observation",
      confidence_pct: 60,
    });
  }

  const overallPct = Math.round(
    (response.trust_layer_engine_layer?.trust_layer.confidence ?? 0.5) * 100,
  );

  const freshness = response.trust_layer_engine_layer?.trust_layer.recency.freshness_score ?? 0.5;

  return {
    data_used: {
      care_events: [...new Set(care_events)],
      timeline_segments: [...new Set(timeline_segments)],
      caregiver_inputs: [...new Set(caregiver_inputs)],
    },
    data_ignored: {
      conflicting: [...new Set(conflicting)],
      low_confidence: [...new Set(low_confidence)],
      stale_or_decayed: [...new Set(stale_or_decayed)],
    },
    reason_for_output,
    evidence_breakdown,
    confidence_scores: {
      overall_pct: overallPct,
      tier: tierFromPct(overallPct),
    },
    recency: {
      last_update_at:
        response.trust_layer_engine_layer?.trust_layer.recency.last_updated_at ??
        response.context.updated_at ??
        null,
      critical_event_ages: events.slice(-3).map((e) => `${e.id} @ ${e.timestamp}`),
      decay_status: decayFromFreshness(freshness),
    },
    observed: [
      ...response.trust_layer_engine_layer?.trust_layer.known.map((k) => k.statement) ?? [],
      ...response.what_i_understood.map((u) => u.label),
    ].slice(0, 8),
    inferred: [
      ...response.trust_layer_engine_layer?.trust_layer.assumed.map((a) => a.statement) ?? [],
      ...(input.final_output_draft?.decision_trace.assumptions ?? []),
    ].slice(0, 8),
  };
}

export function validateCareTransparencyPanel(panel: CareTransparencyPanel): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!panel.reason_for_output?.trim()) {
    errors.push("reason_for_output required");
  }
  if (panel.confidence_scores.overall_pct < 0 || panel.confidence_scores.overall_pct > 100) {
    errors.push("confidence_scores.overall_pct out of range");
  }
  if (!panel.recency.decay_status) {
    errors.push("recency.decay_status required");
  }
  if (panel.observed.length === 0 && panel.inferred.length === 0 && panel.data_used.care_events.length === 0) {
    if (!panel.reason_for_output?.trim()) {
      errors.push("must surface data_used or observation/inference split");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function processCareTransparency(input: BuildCareTransparencyInput): CareTransparencyResult {
  const panel = buildCareTransparencyPanel(input);
  const { valid, errors } = validateCareTransparencyPanel(panel);

  return {
    active: true,
    panel,
    valid,
    validation_errors: errors,
    rules_upheld: [...TRANSPARENCY_RULES],
    defining_principle:
      "Every output is invalid if it does not include a complete Care Transparency Panel.",
  };
}

export function attachTransparencyToFinalOutput<
  T extends import("../final-output-contract/types").FinalOutputContract,
>(output: T, panel: CareTransparencyPanel): T & { transparency_panel: CareTransparencyPanel } {
  return { ...output, transparency_panel: panel };
}
