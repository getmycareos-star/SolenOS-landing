import type { CanonicalCareEvent } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { AuditTrailSummary } from "./types";
import type { EvidenceBundle, EvidenceItem } from "./types";

function eventToEvidence(event: CanonicalCareEvent): EvidenceItem {
  return {
    kind: "care_event",
    id: event.id,
    label: event.raw_input.slice(0, 120),
    captured_at: event.ingestion_time,
    confidence: event.integrity.field_confidence.extracted_fact.extraction,
    source_type: event.source,
  };
}

function correctionToEvidence(audit: AuditTrailSummary): EvidenceItem {
  return {
    kind: "correction",
    id: `${audit.event_id}_${audit.changed_at}`,
    label: formatCorrectionLabel(audit),
    captured_at: audit.changed_at,
    confidence: null,
    source_type: audit.changed_by,
  };
}

function formatCorrectionLabel(audit: AuditTrailSummary): string {
  if (audit.original_value && audit.updated_value) {
    return `${audit.field_label}: ${audit.original_value} → ${audit.updated_value}`;
  }
  return `${audit.field_label} changed by ${audit.changed_by}`;
}

export function buildEvidenceBundle(input: {
  insight_id: string;
  insight_label: string;
  supporting_events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  audit_summaries: AuditTrailSummary[];
  unresolved_questions: string[];
}): EvidenceBundle {
  const related_documents: EvidenceItem[] = [];
  if (input.dare?.raw_input.document_id) {
    related_documents.push({
      kind: "document",
      id: input.dare.raw_input.document_id,
      label: input.dare.raw_input.document_name ?? "Attached document",
      captured_at: input.dare.raw_input.captured_at,
      confidence: input.dare.raw_input.ocr_confidence !== null
        ? String(input.dare.raw_input.ocr_confidence)
        : null,
      source_type: input.dare.raw_input.input_type,
    });
  }

  const timeline_references = input.supporting_events.map((e) => ({
    kind: "timeline_ref" as const,
    id: e.id,
    label: `${e.timestamp.slice(0, 10)} — ${e.extracted_type.replace(/_/g, " ")}`,
    captured_at: e.event_time.type !== "unknown" ? (e.event_time.start ?? e.timestamp) : e.timestamp,
    confidence: e.integrity.field_confidence.event_time.extraction,
    source_type: e.source,
  }));

  const unresolved_uncertainties = input.unresolved_questions.map((q, i) => ({
    kind: "unresolved_uncertainty" as const,
    id: `unresolved_${i}`,
    label: q,
    captured_at: null,
    confidence: null,
    source_type: null,
  }));

  return {
    insight_id: input.insight_id,
    insight_label: input.insight_label,
    supporting_events: input.supporting_events.map(eventToEvidence),
    related_documents,
    user_corrections: input.audit_summaries.map(correctionToEvidence),
    timeline_references,
    unresolved_uncertainties,
  };
}

export function buildEvidenceBundles(input: {
  events_created: CanonicalCareEvent[];
  context_events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  audit_summaries: AuditTrailSummary[];
  what_changed: string[];
  unresolved_questions: string[];
}): EvidenceBundle[] {
  const bundles: EvidenceBundle[] = [];

  for (const event of input.events_created) {
    bundles.push(
      buildEvidenceBundle({
        insight_id: event.id,
        insight_label: event.raw_input.slice(0, 80),
        supporting_events: [event, ...input.context_events.filter((e) => e.id !== event.id).slice(0, 3)],
        dare: input.dare,
        audit_summaries: input.audit_summaries.filter((a) => a.event_id === event.id),
        unresolved_questions: event.uncertainty,
      }),
    );
  }

  for (const change of input.what_changed) {
    bundles.push(
      buildEvidenceBundle({
        insight_id: `change_${bundles.length}`,
        insight_label: change,
        supporting_events: input.events_created,
        dare: input.dare,
        audit_summaries: input.audit_summaries,
        unresolved_questions: input.unresolved_questions,
      }),
    );
  }

  if (bundles.length === 0 && input.context_events.length > 0) {
    bundles.push(
      buildEvidenceBundle({
        insight_id: "context_summary",
        insight_label: "Care context summary",
        supporting_events: input.context_events.slice(-5),
        dare: input.dare,
        audit_summaries: input.audit_summaries,
        unresolved_questions: input.unresolved_questions,
      }),
    );
  }

  return bundles;
}

export function flattenEvidenceItems(bundle: EvidenceBundle): EvidenceItem[] {
  return [
    ...bundle.supporting_events,
    ...bundle.related_documents,
    ...bundle.user_corrections,
    ...bundle.timeline_references,
    ...bundle.unresolved_uncertainties,
  ];
}
