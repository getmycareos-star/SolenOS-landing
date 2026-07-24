import type { CanonicalCareEvent } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { ExtractionConfidence, VerificationStatus } from "./types";

function levelFromScore(score: number): ExtractionConfidence["confidence_level"] {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

function verificationFromEvent(event: CanonicalCareEvent): VerificationStatus {
  if (event.integrity.field_confidence.extracted_fact.user_confirmed) return "user_confirmed";
  if (event.status === "invalidated") return "rejected";
  if (event.status === "provisional" || event.status === "unparsed_raw") return "needs_confirmation";
  return "unverified";
}

export function buildConfidenceForEvent(event: CanonicalCareEvent): ExtractionConfidence {
  const fc = event.integrity.field_confidence.extracted_fact;
  const score =
    fc.extraction === "high" ? 0.9 : fc.extraction === "medium" ? 0.7 : 0.45;

  const known_facts: string[] = [event.raw_input.slice(0, 120)];
  if (event.entities.length > 0) {
    known_facts.push(`Entities: ${event.entities.map((e) => e.label).join(", ")}`);
  }

  const unknown_facts = [...event.uncertainty];
  if (event.event_time.type === "unknown") unknown_facts.push("When this happened");
  if (event.event_time.type === "range" || event.event_time.type === "approximate") {
    unknown_facts.push("Exact timing");
  }

  return {
    object_id: event.id,
    object_type: "event",
    confidence_score: score,
    confidence_level: levelFromScore(score),
    uncertainty_reason:
      event.status === "unparsed_raw"
        ? "Extraction incomplete — raw input preserved"
        : event.status === "provisional"
          ? "Low confidence extraction — needs review"
          : unknown_facts.length > 0
            ? "Partial information available"
            : "Structured with available evidence",
    known_facts,
    unknown_facts,
    missing_information: unknown_facts,
    verification_status: verificationFromEvent(event),
    needs_confirmation_before_linking:
      event.status === "provisional" ||
      event.status === "unparsed_raw" ||
      unknown_facts.length >= 2,
  };
}

export function buildConfidenceFromDare(dare: DareIngestResult): ExtractionConfidence[] {
  const summaries: ExtractionConfidence[] = [];

  for (const c of dare.candidates) {
    summaries.push({
      object_id: c.id,
      object_type: "candidate",
      confidence_score: c.confidence,
      confidence_level: levelFromScore(c.confidence),
      uncertainty_reason:
        c.ambiguity_flags.length > 0
          ? `Ambiguity: ${c.ambiguity_flags.join(", ")}`
          : c.missing_fields.length > 0
            ? "Missing fields in extraction"
            : "Candidate awaiting validation",
      known_facts: [c.extracted_fact],
      unknown_facts: c.missing_fields,
      missing_information: c.missing_fields,
      verification_status: "unverified",
      needs_confirmation_before_linking: c.confidence < 0.85 || c.ambiguity_flags.length > 0,
    });
  }

  summaries.push({
    object_id: dare.raw_input.id,
    object_type: "raw_input",
    confidence_score: dare.raw_input.ocr_confidence ?? 0.75,
    confidence_level: levelFromScore(dare.raw_input.ocr_confidence ?? 0.75),
    uncertainty_reason: "Original submission preserved",
    known_facts: [dare.raw_input.content.slice(0, 200)],
    unknown_facts: [],
    missing_information: [],
    verification_status: "unverified",
    needs_confirmation_before_linking: false,
  });

  return summaries;
}
