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

/** DUP-006: Fall phrasing variation - "slipped" vs "had a fall" */
export function detectFallPhrasingVariation(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const fallKeywords = ["fall", "fell", "slipped", "trip", "tumble", "stumble"];
  if (!hasKeyword(incoming.content, fallKeywords)) return null;

  const match = existingEvents.find((e) => {
    if (!hasKeyword(e.content, fallKeywords)) return false;
    
    // For fall events, use more lenient matching
    const { match, confidence, reasons } = semanticEventMatch(incoming, e);
    if (match && confidence >= IDENTITY_CONFIDENCE.medium) return true;
    
    // Fallback: same person, same location, both fall-related, within time window
    const incomingLoc = (incoming.attributes?.location as string)?.toLowerCase();
    const existingLoc = (e.attributes?.location as string)?.toLowerCase();
    const locationMatch = incomingLoc && existingLoc && incomingLoc === existingLoc;
    const personMatch = incoming.person_id === e.person_id;
    
    if (personMatch && locationMatch) {
      const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
      const existingTime = parseEventTimeFromText(e.content, e.created_at).event_time;
      if (incomingTime && existingTime) {
        const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
        const existingMs = new Date(temporalSortKey(existingTime, e.created_at)).getTime();
        const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
        if (diffHours <= 24) return true;
      }
      // Fallback: use captured_at when event times can't be parsed
      const capturedDiffHours = Math.abs(new Date(incoming.captured_at).getTime() - new Date(e.created_at).getTime()) / (1000 * 60 * 60);
      if (capturedDiffHours <= 24) return true;
    }
    return false;
  });

  if (!match) return null;

  const { confidence, reasons } = semanticEventMatch(incoming, match);

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_event",
    confidence: Math.max(confidence, IDENTITY_CONFIDENCE.medium),
    matched_event_id: match.id,
    evidence_relation: "semantic_same_event",
    reasoning: `Same fall event with phrasing variation. ${reasons.join("; ")}. Preserve original wording.`,
    failure_labels: [],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** Check if text contains keyword as whole word (not substring) */
function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    return regex.test(lower);
  });
}

/** Check if text contains symptom keyword (allows word stems like cough->coughing) */
function hasSymptomKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}\\w*`, 'i');
    return regex.test(lower);
  });
}

/** DUP-007: Same hospitalization - ER then admission */
export function detectSameHospitalization(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const hospKeywords = ["er", "emergency", "hospital", "admitted", "admission", "er visit"];
  if (!hasKeyword(incoming.content, hospKeywords)) return null;

  const match = existingEvents.find((e) => {
    if (!hasKeyword(e.content, hospKeywords)) return false;
    
    const { match, confidence, reasons } = semanticEventMatch(incoming, e);
    if (match && confidence >= IDENTITY_CONFIDENCE.medium) return true;
    
    // Fallback: same person, both hospital-related, within time window
    const personMatch = incoming.person_id === e.person_id;
    if (personMatch) {
      const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
      const existingTime = parseEventTimeFromText(e.content, e.created_at).event_time;
      if (incomingTime && existingTime) {
        const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
        const existingMs = new Date(temporalSortKey(existingTime, e.created_at)).getTime();
        const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
        if (diffHours <= 24) return true;
      }
    }
    return false;
  });

  if (!match) return null;

  const { confidence, reasons } = semanticEventMatch(incoming, match);

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence: Math.max(confidence, IDENTITY_CONFIDENCE.medium),
    matched_event_id: match.id,
    evidence_relation: "temporal_sequence_same_episode",
    reasoning: `Same care episode: ER arrival → admission transition. ${reasons.join("; ")}. Not two hospitalizations.`,
    failure_labels: ["RECURRING_EVENT_COLLAPSE"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: ["care_transition", "admission_details"],
  };
}

/** DUP-008: Same appointment - "Neurologist visit" vs "Saw Dr. Smith" */
export function detectSameAppointment(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const apptKeywords = ["appointment", "visit", "saw", "doctor", "dr.", "physician", "neurologist", "cardiologist"];
  if (!hasKeyword(incoming.content, apptKeywords)) return null;

  const match = existingEvents.find((e) => {
    if (!hasKeyword(e.content, apptKeywords)) return false;
    
    const { match, confidence, reasons } = semanticEventMatch(incoming, e);
    if (match && confidence >= IDENTITY_CONFIDENCE.medium) return true;
    
    // Fallback: same person, both appointment-related, within time window
    const personMatch = incoming.person_id === e.person_id;
    if (personMatch) {
      const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
      const existingTime = parseEventTimeFromText(e.content, e.created_at).event_time;
      if (incomingTime && existingTime) {
        const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
        const existingMs = new Date(temporalSortKey(existingTime, e.created_at)).getTime();
        const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
        if (diffHours <= 24) return true;
      }
    }
    return false;
  });

  if (!match) return null;

  const { confidence, reasons } = semanticEventMatch(incoming, match);

  // Check for clinical recommendation/outcome in incoming
  const outcomeKeywords = ["recommended", "prescribed", "referred", "ordered", "scheduled", "follow up", "physical therapy", "therapy"];
  const hasOutcome = outcomeKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const enrichedFields = hasOutcome 
    ? ["provider_name", "specialty_detail", "clinical_recommendation"]
    : ["provider_name", "specialty_detail"];

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence: Math.max(confidence, IDENTITY_CONFIDENCE.medium),
    matched_event_id: match.id,
    evidence_relation: "semantic_same_event",
    reasoning: `Same appointment with additional detail. ${reasons.join("; ")}. Attach detail to existing event.`,
    failure_labels: [],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: enrichedFields,
  };
}

/** DUP-009: Same medication change - "increased dose" vs "new prescription 20mg" */
export function detectSameMedicationChange(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const medChangeKeywords = ["dose", "increased", "decreased", "changed", "prescription", "mg", "medication"];
  if (!hasKeyword(incoming.content, medChangeKeywords)) return null;

  const match = existingEvents.find((e) => {
    if (!hasKeyword(e.content, medChangeKeywords)) return false;
    
    const { match, confidence, reasons } = semanticEventMatch(incoming, e);
    if (match && confidence >= IDENTITY_CONFIDENCE.medium) return true;
    
    // Fallback: same person, both medication-related, within time window
    const personMatch = incoming.person_id === e.person_id;
    if (personMatch) {
      const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
      const existingTime = parseEventTimeFromText(e.content, e.created_at).event_time;
      if (incomingTime && existingTime) {
        const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
        const existingMs = new Date(temporalSortKey(existingTime, e.created_at)).getTime();
        const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
        if (diffHours <= 24) return true;
      }
    }
    return false;
  });

  if (!match) return null;

  const { confidence, reasons } = semanticEventMatch(incoming, match);

  // Check for administration detail in incoming
  const adminKeywords = ["took", "took first dose", "administered", "given", "first dose"];
  const hasAdminDetail = adminKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const enrichedFields = hasAdminDetail 
    ? ["dosage_detail", "prescription_detail", "administration_timing"]
    : ["dosage_detail", "prescription_detail"];

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence: Math.max(confidence, IDENTITY_CONFIDENCE.medium),
    matched_event_id: match.id,
    evidence_relation: "semantic_same_event",
    reasoning: `Same medication change event. ${reasons.join("; ")}. New evidence enriches existing change.`,
    failure_labels: ["UPDATE_AS_NEW_EVENT"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: enrichedFields,
  };
}

/** DUP-010: Same symptom report - "coughing" vs "cough still bothering" */
export function detectSameSymptomReport(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const symptomKeywords = ["cough", "fever", "pain", "nausea", "dizzy", "fatigue", "shortness of breath"];
  const incomingSymptom = symptomKeywords.find(k => hasSymptomKeyword(incoming.content, [k]));
  if (!incomingSymptom) return null;

  const match = existingEvents.find((e) => {
    const existingSymptom = symptomKeywords.find(k => hasSymptomKeyword(e.content, [k]));
    if (existingSymptom !== incomingSymptom) return false;
    
    const { match, confidence, reasons } = semanticEventMatch(incoming, e);
    if (match && confidence >= IDENTITY_CONFIDENCE.medium) return true;
    
    // Fallback: same person, same symptom, within time window
    const personMatch = incoming.person_id === e.person_id;
    if (personMatch) {
      const incomingTime = parseEventTimeFromText(incoming.content, incoming.captured_at).event_time;
      const existingTime = parseEventTimeFromText(e.content, e.created_at).event_time;
      if (incomingTime && existingTime) {
        const incomingMs = new Date(temporalSortKey(incomingTime, incoming.captured_at)).getTime();
        const existingMs = new Date(temporalSortKey(existingTime, e.created_at)).getTime();
        const diffHours = Math.abs(incomingMs - existingMs) / (1000 * 60 * 60);
        if (diffHours <= 24) return true;
      }
    }
    return false;
  });

  if (!match) return null;

  const { confidence, reasons } = semanticEventMatch(incoming, match);

  // Check if this looks like persistence/severity update vs new episode
  const persistenceWords = ["still", "continues", "ongoing", "persistent", "worse", "better", "improving"];
  const isPersistenceUpdate = persistenceWords.some(w => hasKeyword(incoming.content, [w]));

  return {
    incoming_id: incoming.id,
    resolution: isPersistenceUpdate ? "update_existing" : "duplicate_event",
    confidence: Math.max(confidence, IDENTITY_CONFIDENCE.medium),
    matched_event_id: match.id,
    evidence_relation: isPersistenceUpdate ? "semantic_same_event" : "semantic_same_event",
    reasoning: isPersistenceUpdate
      ? `Ongoing symptom persistence/severity update. ${reasons.join("; ")}. Not a new symptom event.`
      : `Same symptom report. ${reasons.join("; ")}. Likely duplicate mention.`,
    failure_labels: isPersistenceUpdate ? ["REPEATED_OBSERVATION_AS_CHANGE"] : [],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
    enriched_fields: isPersistenceUpdate ? ["severity", "persistence"] : [],
  };
}

/** Main semantic same-event detection orchestrator (Category 9B) */
export function detectSemanticSameEvent(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const detectors = [
    detectFallPhrasingVariation,
    detectSameHospitalization,
    detectSameAppointment,
    detectSameMedicationChange,
    detectSameSymptomReport,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}