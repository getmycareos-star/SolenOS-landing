import {
  IDENTITY_TIME_WINDOWS,
  IDENTITY_CONFIDENCE,
  EVIDENCE_RELATIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
} from "./contract-constants";
import type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
} from "./types";
import { temporalSortKey } from "../time-model";
import { parseEventTimeFromText } from "../time-model";
import { semanticEventMatch } from "./semantic-match";

function getEventTimeMs(event: IncomingEvidence | ExistingEvent, referenceTime: string): number {
  const parsed = parseEventTimeFromText(
    "content" in event ? event.content : event.label,
    referenceTime
  );
  // If parsed time has low confidence (e.g., "around 8 PM" -> range with 0.5 confidence),
  // fall back to the reference time (captured_at/created_at) which is more accurate
  if (parsed.event_time && parsed.event_time.confidence >= 0.6) {
    return new Date(temporalSortKey(parsed.event_time, referenceTime)).getTime();
  }
  return new Date(referenceTime).getTime();
}

/** Check if incoming is an update/enrichment to existing event */
function isEnrichmentUpdate(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): { isUpdate: boolean; confidence: number; enrichedFields: string[]; reasons: string[] } {
  const reasons: string[] = [];
  const enrichedFields: string[] = [];
  let score = 0;

  // Same core event (type, person, approximate time)
  if (incoming.person_id !== existing.person_id) {
    return { isUpdate: false, confidence: 0, enrichedFields: [], reasons: ["Different person"] };
  }

  // Time proximity
  const incomingTime = getEventTimeMs(incoming, incoming.captured_at);
  const existingTime = getEventTimeMs(existing, existing.created_at);
  const timeDiffHours = Math.abs(incomingTime - existingTime) / (1000 * 60 * 60);

  if (timeDiffHours > 72) {
    return { isUpdate: false, confidence: 0, enrichedFields: [], reasons: ["Too far apart in time"] };
  }

  if (timeDiffHours <= 24) {
    score += 0.2;
    reasons.push(`Close temporal proximity: ${timeDiffHours.toFixed(1)}h`);
  }

  // Semantic overlap on core event
  const { match: semanticMatch, confidence: semanticConf, reasons: semanticReasons } = 
    semanticEventMatch(incoming, existing);
  
  if (semanticMatch && semanticConf >= IDENTITY_CONFIDENCE.medium) {
    score += 0.4;
    reasons.push(...semanticReasons);
  }

  // New information in incoming that's not in existing
  const newInfo = detectNewInformation(incoming, existing);
  if (newInfo.length > 0) {
    score += 0.3;
    enrichedFields.push(...newInfo);
    reasons.push(`New information: ${newInfo.join(", ")}`);
  }

  // Explicit correction language
  const correctionWords = ["actually", "correction", "corrected", "update", "clarification", "should be"];
  const hasCorrectionLanguage = correctionWords.some(w => incoming.content.toLowerCase().includes(w));
  if (hasCorrectionLanguage) {
    score += 0.2;
    reasons.push("Explicit correction/update language");
  }

  const isUpdate = score >= 0.5;
  return { isUpdate, confidence: Math.min(score, 1), enrichedFields, reasons };
}

function detectNewInformation(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): string[] {
  const newFields: string[] = [];

  // Time specificity
  if (!existing.attributes.approximate_time && incoming.content.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/i)) {
    newFields.push("approximate_time");
  }

  // Injury/detail
  const injuryKeywords = ["bruise", "cut", "bleeding", "swelling", "fracture", "sprain", "injury", "hurt"];
  const incomingHasInjury = injuryKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const existingHasInjury = injuryKeywords.some(k => existing.content.toLowerCase().includes(k));
  if (incomingHasInjury && !existingHasInjury) {
    newFields.push("injury_detail");
  }

  // Location specificity
  const incomingLoc = extractLocation(incoming.content);
  const existingLoc = extractLocation(existing.content);
  if (incomingLoc && !existingLoc) {
    newFields.push("location_detail");
  }

  // Medication administration detail
  const adminKeywords = ["took", "took first dose", "administered", "given", "started taking"];
  const hasAdminDetail = adminKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const existingHasAdmin = adminKeywords.some(k => existing.content.toLowerCase().includes(k));
  if (hasAdminDetail && !existingHasAdmin) {
    newFields.push("administration_detail");
  }

  // Appointment outcome
  const outcomeKeywords = ["recommended", "prescribed", "referred", "ordered", "scheduled", "follow up"];
  const hasOutcome = outcomeKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const existingHasOutcome = outcomeKeywords.some(k => existing.content.toLowerCase().includes(k));
  if (hasOutcome && !existingHasOutcome) {
    newFields.push("appointment_outcome");
  }

  return newFields;
}

function extractLocation(text: string): string | null {
  const locations = ["kitchen", "bathroom", "bedroom", "living room", "hallway", "stairs", "yard", "garage"];
  return locations.find(l => text.toLowerCase().includes(l)) ?? null;
}

/** DUP-026: Same event, new information (time, injury) */
export function detectEnrichmentUpdate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  // Find semantically matching event - use lower threshold for enrichment detection
  const match = existingEvents.find(e => {
    const { match, confidence } = semanticEventMatchSimple(incoming, e);
    // Lower threshold for enrichment: just need some word overlap
    return match && confidence >= 0.2;
  });

  if (!match) return null;

  const { isUpdate, confidence, enrichedFields, reasons } = isEnrichmentUpdate(incoming, match);
  if (!isUpdate) return null;

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence,
    matched_event_id: match.id,
    evidence_relation: "semantic_same_event",
    reasoning: `Same fall event enriched with new details. ${reasons.join("; ")}. Not a second fall.`,
    failure_labels: ["UPDATE_AS_NEW_EVENT"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: enrichedFields,
  };
}

/** DUP-027: Same event, changed understanding (injury status update) */
export function detectUnderstandingCorrection(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const match = existingEvents.find(e => {
    const { match, confidence } = semanticEventMatchSimple(incoming, e);
    // Lower threshold for correction detection - just need some word overlap
    return match && confidence >= 0.2;
  });

  if (!match) return null;

  // Check for correction language changing a claim
  const correctionPatterns = [
    { from: "no injury", to: "bruise|injury|hurt" },
    { from: "no fall", to: "fall|fell|slipped" },
    { from: "fine", to: "not fine|worse|declined" },
    { from: "stable", to: "unstable|worse|declined" },
  ];

  const incomingLower = incoming.content.toLowerCase();
  const existingLower = match.content.toLowerCase();

  for (const pattern of correctionPatterns) {
    const fromRegex = new RegExp(pattern.from, "i");
    const toRegex = new RegExp(pattern.to, "i");
    if (fromRegex.test(existingLower) && toRegex.test(incomingLower)) {
      return {
        incoming_id: incoming.id,
        resolution: "update_existing",
        confidence: IDENTITY_CONFIDENCE.high,
        matched_event_id: match.id,
        evidence_relation: "semantic_same_event",
        reasoning: `Same event, injury status updated via correction. "No injury" → "Bruise developed". Preserve correction history.`,
        failure_labels: ["CORRECTION_AS_NEW_EVENT", "UPDATE_AS_NEW_EVENT"],
        requires_clarification: false,
        combined_evidence: [...match.evidence_ids, incoming.id],
        enriched_fields: ["injury_status", "correction_history"],
      };
    }
  }

  return null;
}

/** DUP-028: Same medication event, administration detail added */
export function detectMedicationAdministrationDetail(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const medStartKeywords = ["started", "new medication", "prescribed", "began"];
  const incomingHasStart = medStartKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasStart) return null;

  const match = existingEvents.find(e =>
    e.person_id === incoming.person_id &&
    (e.extracted_type === "medication_started" || e.extracted_type === "medication_changed") &&
    e.content.toLowerCase().includes("medication")
  );

  if (!match) return null;

  // Check for administration detail in incoming
  const adminKeywords = ["took", "took first dose", "took the first dose", "administered", "first dose"];
  const hasAdminDetail = adminKeywords.some(k => incoming.content.toLowerCase().includes(k));
  
  if (!hasAdminDetail) return null;

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "semantic_same_event",
    reasoning: `Same medication initiation. Administration detail added (first dose timing). Medication identity remains unknown if not supplied.`,
    failure_labels: ["UPDATE_AS_NEW_EVENT"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: ["administration_timing", "first_dose_confirmation"],
  };
}

/** DUP-029: Appointment outcome added later */
export function detectAppointmentOutcomeAdded(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const apptKeywords = ["appointment", "visit", "saw", "doctor", "dr."];
  const incomingHasAppt = apptKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasAppt) return null;

  const match = existingEvents.find(e =>
    e.person_id === incoming.person_id &&
    apptKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (!match) return null;

  // Check for outcome/recommendation in incoming
  const outcomeKeywords = ["recommended", "prescribed", "referred", "ordered", "suggested", "physical therapy", "pt", "follow up"];
  const hasOutcome = outcomeKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const existingHasOutcome = outcomeKeywords.some(k => match.content.toLowerCase().includes(k));

  if (hasOutcome && !existingHasOutcome) {
    return {
      incoming_id: incoming.id,
      resolution: "update_existing",
      confidence: IDENTITY_CONFIDENCE.high,
      matched_event_id: match.id,
      evidence_relation: "semantic_same_event",
      reasoning: `Same neurology appointment. Recommendation (physical therapy) becomes additional evidence.`,
      failure_labels: ["UPDATE_AS_NEW_EVENT"],
      requires_clarification: false,
      combined_evidence: [...match.evidence_ids, incoming.id],
      enriched_fields: ["clinical_recommendation", "follow_up_plan"],
    };
  }

  return null;
}

/** DUP-030: Genuinely unclear - "fell recently" vs "fell again around then" */
export function detectAmbiguousRecurrence(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const fallKeywords = ["fall", "fell", "slipped", "trip"];
  const incomingHasFall = fallKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasFall) return null;

  const recurrenceWords = ["again", "another", "second", "repeat", "recurred"];
  const hasRecurrenceLanguage = recurrenceWords.some(w => incoming.content.toLowerCase().includes(w));
  if (!hasRecurrenceLanguage) return null;

  // Find recent fall
  const recentFall = existingEvents
    .filter(e => e.person_id === incoming.person_id && fallKeywords.some(k => e.content.toLowerCase().includes(k)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (!recentFall) return null;

  // Check if timing is genuinely unclear
  const incomingTime = getEventTimeMs(incoming, incoming.captured_at);
  const existingTime = getEventTimeMs(recentFall, recentFall.created_at);
  const timeDiffHours = Math.abs(incomingTime - existingTime) / (1000 * 60 * 60);

  // If within 48h but "again" language used, it's ambiguous
  if (timeDiffHours <= 48 && timeDiffHours > 1) {
    return {
      incoming_id: incoming.id,
      resolution: "ambiguous_insufficient_evidence",
      confidence: IDENTITY_CONFIDENCE.ambiguous,
      matched_event_id: recentFall.id,
      evidence_relation: "unclear_relationship",
      reasoning: `"Again" suggests recurrence but timing (${timeDiffHours.toFixed(1)}h apart) is insufficient to establish distinct event identity confidently. Preserve ambiguity, seek clarification.`,
      failure_labels: ["EVENT_IDENTITY_ERROR", "RECURRENCE_DEDUPLICATION"],
      requires_clarification: true,
      clarification_question: `Did this fall happen at a different time than the fall on ${new Date(recentFall.created_at).toLocaleDateString()}, or is this the same fall mentioned again?`,
      combined_evidence: [...recentFall.evidence_ids, incoming.id],
    };
  }

  return null;
}

// Simple semantic match without full import
function semanticEventMatchSimple(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): { match: boolean; confidence: number } {
  if (incoming.person_id !== existing.person_id) return { match: false, confidence: 0 };
  
  let score = 0;
  const incomingWords = new Set(incoming.content.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const existingWords = new Set(existing.content.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const overlap = [...incomingWords].filter(w => existingWords.has(w)).length;
  score += Math.min(0.4, overlap * 0.1);
  
  // Lower threshold for enrichment detection - just need some word overlap
  return { match: score >= 0.2, confidence: Math.min(score, 1) };
}

/** Main duplicate vs update detection orchestrator (Category 9F) */
export function detectDuplicateVsUpdate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const detectors = [
    detectEnrichmentUpdate,
    detectUnderstandingCorrection,
    detectMedicationAdministrationDetail,
    detectAppointmentOutcomeAdded,
    detectAmbiguousRecurrence,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}