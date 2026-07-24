import { createConflictId, listValidatedForCaregiver, storeConflict } from "./projection-store";
import type { ConflictingEventSet, ExtractionCandidate, RawInput } from "./types";

const FALL_DATE = /\b(fell|fall)\b[^.]{0,60}\b(march|january|february|april|may|june|july|august|september|october|november|december|\d{1,2}[/-]\d{1,2})\b/i;

function extractDateReference(text: string): string | null {
  const m = text.match(
    /\b(march|january|february|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|yesterday|today\b/i,
  );
  return m ? m[0] : null;
}

/** Cross-document reconciliation — never overwrite conflicting claims. */
export function reconcileCrossDocument(
  caregiverId: string,
  newCandidates: ExtractionCandidate[],
  rawInputs: RawInput[],
): ConflictingEventSet[] {
  const prior = listValidatedForCaregiver(caregiverId);
  const detected: ConflictingEventSet[] = [];

  const fallCandidates = newCandidates.filter((c) => c.event_signal === "possible_fall");
  const fallDates = fallCandidates.map((c) => ({
    candidate: c,
    date: extractDateReference(c.source_span),
    raw: rawInputs.find((r) => r.id === c.raw_input_id),
  }));

  const uniqueDates = [...new Set(fallDates.map((f) => f.date).filter(Boolean))];
  if (uniqueDates.length >= 2) {
    detected.push({
      id: createConflictId(),
      event_signal: "possible_fall",
      claims: fallDates
        .filter((f) => f.date)
        .map((f) => ({
          source_raw_input_id: f.candidate.raw_input_id,
          source_document_id: f.raw?.document_id ?? null,
          claim: f.candidate.extracted_fact,
          date_reference: f.date,
          confidence: f.candidate.confidence,
        })),
      unresolved: true,
      created_at: new Date().toISOString(),
    });
  }

  for (const c of newCandidates) {
    if (!FALL_DATE.test(c.source_span)) continue;
    const date = extractDateReference(c.source_span);
    const conflicting = prior.filter(
      (p) =>
        p.event_signal === "possible_fall" &&
        date &&
        p.attributes.date_reference &&
        p.attributes.date_reference !== date,
    );
    if (conflicting.length > 0) {
      detected.push({
        id: createConflictId(),
        event_signal: "possible_fall",
        claims: [
          ...conflicting.map((p) => ({
            source_raw_input_id: p.raw_input_id,
            source_document_id: p.document_id,
            claim: p.extracted_fact,
            date_reference: String(p.attributes.date_reference ?? null),
            confidence: p.confidence_score,
          })),
          {
            source_raw_input_id: c.raw_input_id,
            source_document_id: rawInputs.find((r) => r.id === c.raw_input_id)?.document_id ?? null,
            claim: c.extracted_fact,
            date_reference: date,
            confidence: c.confidence,
          },
        ],
        unresolved: true,
        created_at: new Date().toISOString(),
      });
    }
  }

  for (const conflict of detected) {
    storeConflict(conflict, caregiverId);
  }

  return detected;
}
