/**
 * ExtractionStage — Stage 1 of the SolenOS Intelligence Pipeline.
 *
 * Transforms raw caregiver input + documents into structured events via DARE.
 * Contract: Never loses raw input. Never skips extraction. Falls back to deterministic.
 *
 * Input:  Raw input string + optional documents
 * Output: ExtractionResult (validated events, provisional events, uncertainties)
 */

import { ingestRawInput, validatedToCanonical } from "../../lib/data-acquisition-resilience";
import type { DareIngestResult } from "../../lib/data-acquisition-resilience/types";
import type { CanonicalCareEvent } from "../../lib/situation-entry/types";
import {
  buildProvisionalEvent,
  buildUnparsedRawEvent,
} from "../../lib/care-event-integrity";
import { recordDocumentSourceEvidence } from "../../lib/document-evidence";
import type { ExtractionInput, ExtractionResult } from "../types";

function mergeDareResults(results: DareIngestResult[]): DareIngestResult {
  if (results.length === 0) {
    throw new Error("No DARE ingest results");
  }
  const first = results[0]!;
  return {
    raw_input: first.raw_input,
    candidates: results.flatMap((r) => r.candidates),
    uncertain_events: results.flatMap((r) => r.uncertain_events),
    unreadable_sections: results.flatMap((r) => r.unreadable_sections),
    disambiguation_questions: results.flatMap((r) => r.disambiguation_questions),
    conflicts: results.flatMap((r) => r.conflicts),
    validated_events: results.flatMap((r) => r.validated_events),
    provisional_count: results.reduce((n, r) => n + r.provisional_count, 0),
    normalization: results[results.length - 1]?.normalization ?? null,
  };
}

function caregiverLineFromDareUncertain(uncertain: any): string | null {
  if (!uncertain?.description) return null;
  return `Uncertain: ${uncertain.description}`;
}

function caregiverLineFromUnreadableSection(reason: string): string | null {
  if (!reason) return null;
  return `Could not fully read: ${reason}`;
}

/**
 * Extract structured events from raw caregiver input and documents.
 * Uses DARE for extraction with deterministic fallback.
 */
export async function extractFromInput(input: ExtractionInput): Promise<ExtractionResult> {
  const { raw_input, documents, caregiverId, timestamp } = input;
  const dareResults: DareIngestResult[] = [];

  // Process raw text input
  if (raw_input.trim()) {
    dareResults.push(
      ingestRawInput({
        caregiver_id: caregiverId,
        content: raw_input,
        input_type: "text",
        captured_at: timestamp,
      }),
    );
  }

  // Process documents
  let documentEventsCount = 0;
  for (const doc of documents ?? []) {
    if (!doc.extracted_text?.trim()) continue;
    await recordDocumentSourceEvidence({
      careKey: caregiverId,
      documentId: doc.id,
      originalName: doc.name,
      mimeType: doc.mime_type ?? null,
      extractedText: doc.extracted_text,
      capturedAt: timestamp,
    });
    dareResults.push(
      ingestRawInput({
        caregiver_id: caregiverId,
        content: doc.extracted_text,
        input_type: "pdf",
        document_id: doc.id,
        document_name: doc.name,
        ocr_confidence: doc.ocr_confidence ?? null,
        captured_at: timestamp,
      }),
    );
    documentEventsCount += 1;
  }

  const dare = dareResults.length > 0 ? mergeDareResults(dareResults) : null;

  // Build events from DARE results
  const events: CanonicalCareEvent[] = [];
  if (dare) {
    for (const ve of dare.validated_events) {
      const canonical = validatedToCanonical(ve);
      canonical.root_event_id = null;
      canonical.situation_id = null;
      canonical.document_id = ve.document_id;
      events.push(canonical);
    }

    for (const result of dareResults) {
      if (
        result.unreadable_sections.length > 0 ||
        (result.normalization?.could_not_process && result.validated_events.length === 0)
      ) {
        const unparsed = buildUnparsedRawEvent({
          rawInput: result.raw_input,
          reason:
            result.unreadable_sections[0]?.reason ??
            result.normalization?.clarification_question ??
            "extraction_failed",
          caregiverId,
        });
        unparsed.root_event_id = null;
        unparsed.situation_id = null;
        events.push(unparsed);
      }

      for (const uncertain of result.uncertain_events) {
        const provisional = buildProvisionalEvent({
          uncertain,
          rawInput: result.raw_input,
          caregiverId,
        });
        provisional.root_event_id = null;
        provisional.situation_id = null;
        events.push(provisional);
      }
    }
  }

  // Fallback: ensure at least raw event exists
  if (raw_input.trim() && events.length === 0) {
    const fallbackRaw = {
      id: `raw_fallback_${Date.now()}`,
      caregiver_id: caregiverId,
      input_type: "text" as const,
      content: raw_input.trim(),
      ocr_confidence: null,
      document_id: null,
      document_name: null,
      captured_at: timestamp ?? new Date().toISOString(),
      metadata: {},
    };
    const unparsed = buildUnparsedRawEvent({
      rawInput: fallbackRaw,
      reason: "free_text_observation",
      caregiverId,
    });
    unparsed.root_event_id = null;
    unparsed.situation_id = null;
    events.push(unparsed);
  }

  // Build provisional from DARE uncertainties
  const provisionalFromDare = dare
    ? [
        ...dare.uncertain_events
          .map((u) => caregiverLineFromDareUncertain(u))
          .filter((line): line is string => Boolean(line)),
        ...dare.unreadable_sections.map((s) =>
          caregiverLineFromUnreadableSection(s.reason),
        ),
        ...dare.disambiguation_questions.map((q) =>
          q.question ? `Clarification needed: ${q.question}` : null
        ).filter((line): line is string => Boolean(line)),
      ].filter((line): line is string => typeof line === "string")
    : [];

  return {
    events,
    dare,
    documentEventsCount,
    provisionalFromDare,
  };
}

