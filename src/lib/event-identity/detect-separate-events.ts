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

function getEventTimeMs(event: IncomingEvidence | ExistingEvent, referenceTime: string): number {
  const parsed = parseEventTimeFromText(
    "content" in event ? event.content : event.label,
    referenceTime
  );
  if (parsed.event_time) {
    return new Date(temporalSortKey(parsed.event_time, referenceTime)).getTime();
  }
  return new Date(referenceTime).getTime();
}

/** Check if two events are genuinely separate despite surface similarities. */
function isGenuinelySeparate(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): { separate: boolean; confidence: number; reasons: string[]; ambiguous?: boolean } {
  const reasons: string[] = [];
  let score = 0;

  // Different event times (strongest signal)
  const incomingTime = getEventTimeMs(incoming, incoming.captured_at);
  const existingTime = getEventTimeMs(existing, existing.created_at);
  const timeDiffHours = Math.abs(incomingTime - existingTime) / (1000 * 60 * 60);

  if (timeDiffHours >= 24) {
    score += 0.5;
    reasons.push(`Distinct times: ${timeDiffHours.toFixed(1)}h apart`);
  } else if (timeDiffHours >= 6) {
    score += 0.25;
    reasons.push(`Separate times: ${timeDiffHours.toFixed(1)}h apart`);
  }

  // Different event subtypes/circumstances
  const incomingCircumstances = (incoming.attributes?.circumstances as string)?.toLowerCase();
  const existingCircumstances = (existing.attributes?.circumstances as string)?.toLowerCase();
  if (incomingCircumstances && existingCircumstances && incomingCircumstances !== existingCircumstances) {
    score += 0.2;
    reasons.push("Different circumstances");
  }

  // Different locations
  const incomingLoc = (incoming.attributes?.location as string)?.toLowerCase();
  const existingLoc = (existing.attributes?.location as string)?.toLowerCase();
  if (incomingLoc && existingLoc && incomingLoc !== existingLoc) {
    score += 0.2;
    reasons.push("Different locations");
  }

  // Different associated symptoms/injuries
  const incomingSymptoms = new Set((incoming.attributes?.associated_symptoms as string[])?.map(s => s.toLowerCase()) ?? []);
  const existingSymptoms = new Set((existing.attributes?.associated_symptoms as string[])?.map(s => s.toLowerCase()) ?? []);
  const symptomDiff = [...incomingSymptoms].filter(s => !existingSymptoms.has(s)).length +
    [...existingSymptoms].filter(s => !incomingSymptoms.has(s)).length;
  if (symptomDiff > 0) {
    score += 0.15;
    reasons.push(`${symptomDiff} different symptoms/injuries`);
  }

  // Explicit recurrence language
  const recurrenceWords = ["again", "another", "second", "third", "recurred", "recurrence", "repeated", "repeat"];
  const hasRecurrenceLanguage = recurrenceWords.some(w => incoming.content.toLowerCase().includes(w));
  if (hasRecurrenceLanguage) {
    score += 0.3;
    reasons.push("Explicit recurrence language ('again', 'another', etc.)");
  }

  // Vague timing with recurrence language = ambiguous
  const vagueTimingWords = ["around then", "around that time", "then", "recently", "about then", "sometime then"];
  const hasVagueTiming = vagueTimingWords.some(w => incoming.content.toLowerCase().includes(w));
  if (hasRecurrenceLanguage && hasVagueTiming && timeDiffHours <= 48) {
    return { 
      separate: false, 
      confidence: 0.4, 
      reasons: ["Recurrence language with vague timing reference - unclear if new event or duplicate"],
      ambiguous: true 
    };
  }

  // Different sources (multiple witnesses = separate events more likely)
  if (incoming.source_id !== existing.source_id) {
    score += 0.1;
    reasons.push("Different source");
  }

  const separate = score >= 0.5 && timeDiffHours >= 1; // At least 1 hour apart for separate events
  return { separate, confidence: Math.min(score, 1), reasons };
}

/** DUP-011: Two falls, same location, different days */
export function detectSeparateFalls(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const fallKeywords = ["fall", "fell", "slipped", "trip"];
  const incomingHasFall = fallKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasFall) return null;

  // Find existing fall events for same person
  const existingFalls = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    fallKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingFalls.length === 0) return null;

  // Check if genuinely separate from ALL existing falls
  for (const existingFall of existingFalls) {
    const { separate, confidence, reasons, ambiguous } = isGenuinelySeparate(incoming, existingFall);
    if (ambiguous) {
      return {
        incoming_id: incoming.id,
        resolution: "ambiguous_insufficient_evidence",
        confidence: IDENTITY_CONFIDENCE.ambiguous,
        matched_event_id: existingFall.id,
        evidence_relation: "unclear_relationship",
        reasoning: reasons.join("; "),
        failure_labels: ["AMBIGUOUS_RECURRENCE"],
        requires_clarification: true,
        clarification_question: "Did this happen again, or are you referring to the same fall?",
        combined_evidence: [...existingFall.evidence_ids, incoming.id],
      };
    }
    if (separate && confidence >= IDENTITY_CONFIDENCE.medium) {
      const result = {
        incoming_id: incoming.id,
        resolution: "new_event",
        confidence,
        matched_event_id: null,
        evidence_relation: "explicit_recurrence",
        reasoning: `Genuinely separate fall (recurrence). ${reasons.join("; ")}. Fall count = ${existingFalls.length + 1}.`,
        failure_labels: ["RECURRING_EVENT_COLLAPSE"],
        requires_clarification: false,
        combined_evidence: [...existingFall.evidence_ids, incoming.id],
       };
      return result;
    }
  }
  return null;
}

/** DUP-012: Two ER visits, different reasons */
export function detectSeparateERVisits(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  // Use word boundaries to avoid matching "fever", "serve", etc.
  const erKeywords = [" er ", "emergency room", "emergency", " e.r.", "e.r."];
  const incomingHasER = erKeywords.some(k => ` ${incoming.content.toLowerCase()} `.includes(k));
  if (!incomingHasER) return null;

  const existingERs = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    erKeywords.some(k => ` ${e.content.toLowerCase()} `.includes(k))
  );

  if (existingERs.length === 0) return null;

  for (const existingER of existingERs) {
    const { separate, confidence, reasons, ambiguous } = isGenuinelySeparate(incoming, existingER);
    if (ambiguous) {
      return {
        incoming_id: incoming.id,
        resolution: "ambiguous_insufficient_evidence",
        confidence: IDENTITY_CONFIDENCE.ambiguous,
        matched_event_id: existingER.id,
        evidence_relation: "unclear_relationship",
        reasoning: reasons.join("; "),
        failure_labels: ["AMBIGUOUS_RECURRENCE"],
        requires_clarification: true,
        clarification_question: "Is this a new ER visit or an update to the previous one?",
        combined_evidence: [...existingER.evidence_ids, incoming.id],
      };
    }
    if (separate && confidence >= 0.5) {
      // Check for different chief complaints
      const incomingComplaint = extractChiefComplaint(incoming.content);
      const existingComplaint = extractChiefComplaint(existingER.content);
      if (incomingComplaint && existingComplaint && incomingComplaint !== existingComplaint) {
        reasons.push(`Different chief complaints: "${incomingComplaint}" vs "${existingComplaint}"`);
      }
      return {
        incoming_id: incoming.id,
        resolution: "new_event",
        confidence,
        matched_event_id: null,
        evidence_relation: "explicit_recurrence",
        reasoning: `Separate acute-care episode. ${reasons.join("; ")}.`,
        failure_labels: ["SEPARATE_EVENT_COLLAPSE"],
        requires_clarification: false,
        combined_evidence: [incoming.id],
      };
    }
  }

  return null;
}

function extractChiefComplaint(text: string): string | null {
  const patterns = [
    /for\s+(.+?)(?:\.|$)/i,
    /due to\s+(.+?)(?:\.|$)/i,
    /with\s+(.+?)(?:\.|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().toLowerCase();
  }
  return null;
}

/** DUP-013: Two medication changes, different doses */
export function detectSeparateMedicationChanges(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const medChangeKeywords = ["dose increased", "dose decreased", "increased from", "decreased from", "changed to", "new dose"];
  const incomingHasMedChange = medChangeKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasMedChange) return null;

  const existingMedChanges = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    medChangeKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingMedChanges.length === 0) return null;

  for (const existingMed of existingMedChanges) {
    const { separate, confidence, reasons, ambiguous } = isGenuinelySeparate(incoming, existingMed);
    if (ambiguous) {
      return {
        incoming_id: incoming.id,
        resolution: "ambiguous_insufficient_evidence",
        confidence: IDENTITY_CONFIDENCE.ambiguous,
        matched_event_id: existingMed.id,
        evidence_relation: "unclear_relationship",
        reasoning: reasons.join("; "),
        failure_labels: ["AMBIGUOUS_RECURRENCE"],
        requires_clarification: true,
        clarification_question: "Is this a new medication change or a correction to the previous one?",
        combined_evidence: [...existingMed.evidence_ids, incoming.id],
      };
    }
    if (separate && confidence >= 0.5) {
      // Extract doses to confirm different transitions
      const incomingDoses = extractDoses(incoming.content);
      const existingDoses = extractDoses(existingMed.content);
      if (incomingDoses.length >= 2 && existingDoses.length >= 2) {
        const incomingTransition = `${incomingDoses[0]}→${incomingDoses[1]}`;
        const existingTransition = `${existingDoses[0]}→${existingDoses[1]}`;
        if (incomingTransition !== existingTransition) {
          reasons.push(`Different dose transitions: ${incomingTransition} vs ${existingTransition}`);
        }
      }
      return {
        incoming_id: incoming.id,
        resolution: "new_event",
        confidence,
        matched_event_id: null,
        evidence_relation: "explicit_recurrence",
        reasoning: `Separate medication-change event. ${reasons.join("; ")}. History preserves both transitions.`,
        failure_labels: ["FALSE_DEDUPLICATION"],
        requires_clarification: false,
        combined_evidence: [incoming.id],
      };
    }
  }

  return null;
}

function extractDoses(text: string): number[] {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*mg/gi);
  return matches ? matches.map(m => parseFloat(m.replace(/mg/i, ""))) : [];
}

/** DUP-014: Two appointments, different specialties/dates */
export function detectSeparateAppointments(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const apptKeywords = ["appointment", "visit", "saw", "doctor", "dr."];
  const incomingHasAppt = apptKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasAppt) return null;

  const existingAppts = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    apptKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingAppts.length === 0) return null;

  for (const existingAppt of existingAppts) {
    const { separate, confidence, reasons, ambiguous } = isGenuinelySeparate(incoming, existingAppt);
    if (ambiguous) {
      return {
        incoming_id: incoming.id,
        resolution: "ambiguous_insufficient_evidence",
        confidence: IDENTITY_CONFIDENCE.ambiguous,
        matched_event_id: existingAppt.id,
        evidence_relation: "unclear_relationship",
        reasoning: reasons.join("; "),
        failure_labels: ["AMBIGUOUS_RECURRENCE"],
        requires_clarification: true,
        clarification_question: "Is this a new appointment or a change to the existing one?",
        combined_evidence: [...existingAppt.evidence_ids, incoming.id],
      };
    }
    if (separate && confidence >= 0.5) {
      const incomingSpecialty = extractSpecialty(incoming.content);
      const existingSpecialty = extractSpecialty(existingAppt.content);
      if (incomingSpecialty && existingSpecialty && incomingSpecialty !== existingSpecialty) {
        reasons.push(`Different specialties: ${incomingSpecialty} vs ${existingSpecialty}`);
      }
      return {
        incoming_id: incoming.id,
        resolution: "new_event",
        confidence,
        matched_event_id: null,
        evidence_relation: "explicit_recurrence",
        reasoning: `Separate appointment. ${reasons.join("; ")}. Different specialties and dates.`,
        failure_labels: ["FALSE_DEDUPLICATION"],
        requires_clarification: false,
        combined_evidence: [incoming.id],
      };
    }
  }

  return null;
}

function extractSpecialty(text: string): string | null {
  const specialties = ["primary care", "cardiology", "neurology", "dermatology", "orthopedics", "psychiatry", "oncology"];
  const found = specialties.find(s => text.toLowerCase().includes(s));
  return found ?? null;
}

/** DUP-015: Separate symptom episodes - fever resolved then returned */
export function detectSeparateSymptomEpisodes(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const symptomKeywords = ["fever", "cough", "pain", "nausea", "headache", "rash"];
  const incomingSymptom = symptomKeywords.find(k => incoming.content.toLowerCase().includes(k));
  if (!incomingSymptom) return null;

  // Look for resolved language in existing
  const resolvedWords = ["resolved", "gone", "better", "cleared", "recovered", "subsided"];
  const existingResolved = existingEvents.find(e =>
    e.person_id === incoming.person_id &&
    e.content.toLowerCase().includes(incomingSymptom) &&
    resolvedWords.some(w => e.content.toLowerCase().includes(w))
  );

  if (!existingResolved) return null;

  // Check if incoming indicates recurrence
  const recurrenceWords = ["returned", "back", "again", "recurred", "relapsed", "started again"];
  const hasRecurrence = recurrenceWords.some(w => incoming.content.toLowerCase().includes(w));

  if (!hasRecurrence) return null;

  const { separate, confidence, reasons, ambiguous } = isGenuinelySeparate(incoming, existingResolved);
  if (ambiguous) {
    return {
      incoming_id: incoming.id,
      resolution: "ambiguous_insufficient_evidence",
      confidence: IDENTITY_CONFIDENCE.ambiguous,
      matched_event_id: existingResolved.id,
      evidence_relation: "unclear_relationship",
      reasoning: reasons.join("; "),
      failure_labels: ["AMBIGUOUS_RECURRENCE"],
      requires_clarification: true,
      clarification_question: "Is this a new symptom episode or a continuation of the previous one?",
      combined_evidence: [...existingResolved.evidence_ids, incoming.id],
    };
  }
  if (separate && confidence >= 0.5) {
    return {
      incoming_id: incoming.id,
      resolution: "recurrence",
      confidence,
      matched_event_id: existingResolved.id,
      evidence_relation: "explicit_recurrence",
      reasoning: `Symptom recurrence after resolution. ${reasons.join("; ")}. Two distinct episodes.`,
      failure_labels: ["RECURRING_EVENT_COLLAPSE"],
      requires_clarification: false,
      combined_evidence: [...existingResolved.evidence_ids, incoming.id],
    };
  }

  return null;
}

/** Main genuinely separate events detection orchestrator (Category 9C) */
export function detectGenuinelySeparateEvents(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const detectors = [
    detectSeparateFalls,
    detectSeparateERVisits,
    detectSeparateMedicationChanges,
    detectSeparateAppointments,
    detectSeparateSymptomEpisodes,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}