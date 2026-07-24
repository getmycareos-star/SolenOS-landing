import type { DocumentSignals, DocumentSignalUrgency, ExtractedDocument, SolenOSDocument } from "./types";

const CRITICAL_MARKERS =
  /\b(?:911|emergency|immediately|urgent|critical|life.?threatening|do not delay|stat order)\b/i;
const HIGH_MARKERS =
  /\b(?:deadline|due today|expires today|within 24 hours|overdue|final notice|last day)\b/i;
const MEDIUM_MARKERS =
  /\b(?:due|deadline|required by|respond by|submit by|within \d+ days?|prior authorization)\b/i;

/**
 * Document signals — observational only. Do NOT auto-execute actions.
 */
export function generateDocumentSignals(
  sourceType: SolenOSDocument,
  extracted: ExtractedDocument,
): DocumentSignals {
  const text = extracted.rawText;

  let urgency: DocumentSignalUrgency = "LOW";
  if (CRITICAL_MARKERS.test(text)) {
    urgency = "CRITICAL";
  } else if (HIGH_MARKERS.test(text)) {
    urgency = "HIGH";
  } else if (MEDIUM_MARKERS.test(text) || extracted.obligations.length > 0) {
    urgency = "MEDIUM";
  }

  const actionRequired =
    extracted.obligations.length > 0 ||
    /\b(?:action required|must submit|respond by|prior authorization required|appeal by)\b/i.test(text);

  return {
    urgency,
    category: sourceType,
    actionRequired,
  };
}

export function derivePrioritySignals(signals: DocumentSignals): string[] {
  const priorities: string[] = [`urgency:${signals.urgency}`, `category:${signals.category}`];
  if (signals.actionRequired) priorities.push("action_required_signal");
  return priorities;
}
