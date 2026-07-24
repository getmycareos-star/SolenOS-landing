import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { InputProvenance } from "../care-events/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ProvenanceRecord, ProvenanceSourceType } from "./types";

function sourceTypeFromEvent(event: CanonicalCareEvent): ProvenanceSourceType {
  if (event.source === "document") return "document";
  return "user_input";
}

function sourceLabelFromEvent(
  event: CanonicalCareEvent,
  dare: DareIngestResult | null,
): string {
  if (event.document_id && dare?.raw_input.document_name) {
    return dare.raw_input.document_name;
  }
  if (event.source === "document") return "Attached document";
  return "Caregiver input";
}

function confidenceFromEvent(event: CanonicalCareEvent): "low" | "medium" | "high" {
  const fc = event.integrity.field_confidence.extracted_fact;
  return fc.extraction;
}

function verificationFromEvent(event: CanonicalCareEvent): ProvenanceRecord["verification_status"] {
  if (event.integrity.field_confidence.extracted_fact.user_confirmed) return "user_confirmed";
  if (event.status === "invalidated") return "rejected";
  if (event.status === "provisional" || event.status === "unparsed_raw") return "needs_confirmation";
  if (event.integrity.sources.includes("user_correction")) return "user_confirmed";
  return "unverified";
}

export function buildProvenanceForEvent(
  event: CanonicalCareEvent,
  dare: DareIngestResult | null,
  captureProvenance?: InputProvenance | null,
): ProvenanceRecord {
  let sourceType = sourceTypeFromEvent(event);
  if (captureProvenance?.input_type === "voice") sourceType = "voice";

  const rawInputId = String(event.attributes.raw_input_id ?? dare?.raw_input.id ?? "") || null;

  return {
    fact_id: event.id,
    fact_label: event.raw_input.slice(0, 120),
    source_label: sourceLabelFromEvent(event, dare),
    source_type: sourceType,
    extracted_from:
      event.document_id && dare?.raw_input.document_name
        ? dare.raw_input.document_name
        : captureProvenance?.input_type === "voice"
          ? "Voice capture"
          : null,
    captured_at: event.ingestion_time,
    confidence: confidenceFromEvent(event),
    verification_status: verificationFromEvent(event),
    truth_sources: [...event.integrity.sources],
    raw_input_id: rawInputId,
    event_id: event.id,
    document_id: event.document_id,
  };
}

export function buildProvenanceRecords(
  events: CanonicalCareEvent[],
  dare: DareIngestResult | null,
  captureProvenance?: InputProvenance | null,
): ProvenanceRecord[] {
  return events.map((e) => buildProvenanceForEvent(e, dare, captureProvenance));
}

export function buildDareCandidateProvenance(
  dare: DareIngestResult,
): ProvenanceRecord[] {
  return dare.candidates.map((c) => ({
    fact_id: c.id,
    fact_label: c.extracted_fact,
    source_label: dare.raw_input.document_name ?? "Caregiver input",
    source_type: (dare.raw_input.input_type === "pdf"
      ? "pdf"
      : dare.raw_input.input_type === "ocr_text"
        ? "ocr_text"
        : "text") as ProvenanceSourceType,
    extracted_from: c.source_span || null,
    captured_at: c.created_at,
    confidence: c.confidence >= 0.85 ? "high" : c.confidence >= 0.65 ? "medium" : "low",
    verification_status: "unverified" as const,
    truth_sources: ["ai_inference" as const],
    raw_input_id: c.raw_input_id,
    event_id: null,
    document_id: dare.raw_input.document_id,
  }));
}
