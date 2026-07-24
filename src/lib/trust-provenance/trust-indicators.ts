import type { CanonicalCareEvent } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { ProvenanceRecord, TrustIndicator, TrustIndicatorKind } from "./types";

function createIndicatorId(): string {
  return `ti_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const INDICATOR_LABELS: Record<TrustIndicatorKind, string> = {
  verified_by_caregiver: "✓ Verified by caregiver",
  extracted_from_document: "✓ Extracted from document",
  confirmed_follow_up: "✓ Confirmed during follow-up",
  awaiting_confirmation: "⚠ Awaiting confirmation",
  low_confidence: "⚠ Low confidence",
  missing_evidence: "⚠ Missing supporting evidence",
};

export function trustIndicatorLabel(kind: TrustIndicatorKind): string {
  return INDICATOR_LABELS[kind];
}

export function buildTrustIndicators(
  events: CanonicalCareEvent[],
  provenance: ProvenanceRecord[],
  dare: DareIngestResult | null,
): TrustIndicator[] {
  const indicators: TrustIndicator[] = [];

  for (const event of events) {
    const prov = provenance.find((p) => p.event_id === event.id);

    if (event.integrity.field_confidence.extracted_fact.user_confirmed ||
        event.integrity.sources.includes("user_correction")) {
      indicators.push({
        id: createIndicatorId(),
        kind: "verified_by_caregiver",
        label: INDICATOR_LABELS.verified_by_caregiver,
        event_id: event.id,
        fact_id: prov?.fact_id ?? null,
      });
    }

    if (event.source === "document" || event.document_id) {
      indicators.push({
        id: createIndicatorId(),
        kind: "extracted_from_document",
        label: INDICATOR_LABELS.extracted_from_document,
        event_id: event.id,
        fact_id: prov?.fact_id ?? null,
      });
    }

    if (event.status === "provisional" || event.status === "unparsed_raw") {
      indicators.push({
        id: createIndicatorId(),
        kind: "awaiting_confirmation",
        label: INDICATOR_LABELS.awaiting_confirmation,
        event_id: event.id,
        fact_id: prov?.fact_id ?? null,
      });
    }

    if (event.integrity.field_confidence.extracted_fact.extraction === "low") {
      indicators.push({
        id: createIndicatorId(),
        kind: "low_confidence",
        label: INDICATOR_LABELS.low_confidence,
        event_id: event.id,
        fact_id: prov?.fact_id ?? null,
      });
    }

    if (event.uncertainty.length >= 2 || event.event_time.type === "unknown") {
      indicators.push({
        id: createIndicatorId(),
        kind: "missing_evidence",
        label: INDICATOR_LABELS.missing_evidence,
        event_id: event.id,
        fact_id: prov?.fact_id ?? null,
      });
    }
  }

  if (dare?.validated_events.some((v) => v.validation_method === "user_confirmation")) {
    indicators.push({
      id: createIndicatorId(),
      kind: "confirmed_follow_up",
      label: INDICATOR_LABELS.confirmed_follow_up,
      event_id: null,
      fact_id: null,
    });
  }

  const seen = new Set<string>();
  return indicators.filter((i) => {
    const key = `${i.kind}:${i.event_id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
