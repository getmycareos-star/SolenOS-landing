import type { ContinuousCareEventType, StructuredCareEvent } from "./types";

const FALL_PATTERN = /\b(fell|fall|fallen|tripped|slipped)\b/i;
const MED_PATTERN = /\b(medication|medicine|prescription|dose|mg|pill|started|stopped|changed|increased|decreased)\b/i;
const APPT_PATTERN = /\b(appointment|doctor|clinic|hospital|visit|specialist|neurolog)\b/i;
const SYMPTOM_PATTERN =
  /\b(pain|fever|confus\w*|dizz\w*|nausea|vomit|bleed|swell|weak|tired|sleep|appetite)\b/gi;
const ER_PATTERN = /\b(er\b|emergency room|ambulance|911)\b/i;
const DISCHARGE_PATTERN = /\b(discharge|discharged|sent home from hospital)\b/i;
const ADMISSION_PATTERN = /\b(admitted|admission|hospital stay)\b/i;
const INSURANCE_PATTERN = /\b(insurance|benefits|coverage|claim|prior auth)\b/i;
const THERAPY_PATTERN = /\b(therapy|physical therapy|pt session|occupational therapy)\b/i;
const DECISION_PATTERN = /\b(decided|decision|agreed|chose|will)\b/i;

const DR_PATTERN = /\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
const FOLLOW_UP_PATTERN = /\bfollow[- ]?up\b[^.]{0,80}/gi;
const WATCH_FOR_PATTERN = /\b(watch for|monitor for|look out for)\b[^.]{0,80}/gi;
const DATE_PATTERN = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/;

export function inferContinuousEventType(content: string): ContinuousCareEventType {
  const text = content.trim();
  if (!text) return "unknown";
  if (FALL_PATTERN.test(text)) return "fall";
  if (ER_PATTERN.test(text)) return "emergency_visit";
  if (DISCHARGE_PATTERN.test(text)) return "hospital_discharge";
  if (ADMISSION_PATTERN.test(text)) return "hospital_admission";
  if (INSURANCE_PATTERN.test(text)) return "insurance_call";
  if (THERAPY_PATTERN.test(text)) return "therapy_session";
  if (MED_PATTERN.test(text)) return "medication_change";
  if (/specialist/i.test(text)) return "specialist_visit";
  if (APPT_PATTERN.test(text)) return "appointment";
  if (SYMPTOM_PATTERN.test(text)) return "symptom";
  if (DECISION_PATTERN.test(text)) return "family_decision";
  return "caregiver_note";
}

function extractPeople(content: string): string[] {
  const people = new Set<string>();
  for (const match of content.matchAll(DR_PATTERN)) {
    people.add(match[0].trim());
  }
  return [...people];
}

function extractSymptoms(content: string): string[] {
  const symptoms = new Set<string>();
  for (const match of content.matchAll(SYMPTOM_PATTERN)) {
    symptoms.add(match[0].toLowerCase());
  }
  return [...symptoms];
}

function extractDecisions(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return sentences.filter((s) => /changed from|decided|will start|switched to|increased|decreased/i.test(s));
}

function extractActions(content: string): string[] {
  const actions: string[] = [];
  for (const match of content.matchAll(FOLLOW_UP_PATTERN)) {
    actions.push(match[0].trim());
  }
  const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    if (/\b(call|schedule|refill|submit|follow up)\b/i.test(s)) {
      actions.push(s);
    }
  }
  return [...new Set(actions)].slice(0, 5);
}

function extractWatchFor(content: string): string[] {
  const items: string[] = [];
  for (const match of content.matchAll(WATCH_FOR_PATTERN)) {
    items.push(match[0].trim());
  }
  if (/\bdizz\w*\b/i.test(content) && !items.some((i) => /dizz/i.test(i))) {
    items.push("Dizziness");
  }
  return items;
}

function extractFollowUpDate(content: string): string | null {
  const match = content.match(DATE_PATTERN);
  return match ? match[0] : null;
}

function buildSummary(content: string): string {
  const trimmed = content.trim();
  const firstSentence = trimmed.split(/[.!?]+/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 20) return firstSentence;
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
}

export type StructureInputParams = {
  content: string;
  occurred_at?: string | null;
  event_type?: ContinuousCareEventType;
  document_refs?: { id: string; name: string; mime_type?: string; extracted_preview?: string }[];
  parent_event_id?: string | null;
};

export function structureCareInput(params: StructureInputParams): StructuredCareEvent {
  const content = params.content.trim();
  const eventType = params.event_type ?? inferContinuousEventType(content);
  const date = params.occurred_at ?? new Date().toISOString();

  return {
    event_type: eventType,
    date,
    people_involved: extractPeople(content),
    summary: buildSummary(content),
    decisions_made: extractDecisions(content),
    actions_required: extractActions(content),
    follow_up_date: extractFollowUpDate(content),
    symptoms_mentioned: extractSymptoms(content),
    documents_attached: (params.document_refs ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      mime_type: d.mime_type,
      extracted_preview: d.extracted_preview?.slice(0, 300),
    })),
    watch_for: extractWatchFor(content),
    outcome: { status: "pending", summary: "Pending", recorded_at: date },
    parent_event_id: params.parent_event_id ?? null,
    related_event_ids: [],
  };
}

export function parseStructuredFromMetadata(
  metadata: Record<string, unknown>,
  fallbackContent: string,
  fallbackType: ContinuousCareEventType,
  fallbackDate: string,
): StructuredCareEvent {
  const raw = metadata.structured;
  if (!raw || typeof raw !== "object") {
    return structureCareInput({
      content: fallbackContent,
      occurred_at: fallbackDate,
      event_type: fallbackType,
    });
  }
  const obj = raw as Record<string, unknown>;
  return {
    event_type: (typeof obj.event_type === "string"
      ? obj.event_type
      : fallbackType) as ContinuousCareEventType,
    date: typeof obj.date === "string" ? obj.date : fallbackDate,
    people_involved: Array.isArray(obj.people_involved)
      ? obj.people_involved.filter((x): x is string => typeof x === "string")
      : [],
    summary: typeof obj.summary === "string" ? obj.summary : buildSummary(fallbackContent),
    decisions_made: Array.isArray(obj.decisions_made)
      ? obj.decisions_made.filter((x): x is string => typeof x === "string")
      : [],
    actions_required: Array.isArray(obj.actions_required)
      ? obj.actions_required.filter((x): x is string => typeof x === "string")
      : [],
    follow_up_date: typeof obj.follow_up_date === "string" ? obj.follow_up_date : null,
    symptoms_mentioned: Array.isArray(obj.symptoms_mentioned)
      ? obj.symptoms_mentioned.filter((x): x is string => typeof x === "string")
      : [],
    documents_attached: Array.isArray(obj.documents_attached)
      ? (obj.documents_attached as StructuredCareEvent["documents_attached"])
      : [],
    watch_for: Array.isArray(obj.watch_for)
      ? obj.watch_for.filter((x): x is string => typeof x === "string")
      : [],
    outcome:
      obj.outcome && typeof obj.outcome === "object"
        ? (obj.outcome as StructuredCareEvent["outcome"])
        : { status: "pending", summary: "Pending", recorded_at: fallbackDate },
    parent_event_id: typeof obj.parent_event_id === "string" ? obj.parent_event_id : null,
    related_event_ids: Array.isArray(obj.related_event_ids)
      ? obj.related_event_ids.filter((x): x is string => typeof x === "string")
      : [],
  };
}
