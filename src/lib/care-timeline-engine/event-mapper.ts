import {
  DOSAGE_PATTERN,
  MED_CHANGE_PATTERN,
  MED_START_PATTERN,
  MEDICATION_PATTERN,
} from "./contract-constants";
import type { SourceChannel, TimelineEvent, TimelineEventType } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";

function mapSourceChannel(event: CanonicalCareEvent): SourceChannel {
  if (event.source === "document") return "pdf";
  const inputType = event.attributes.input_type;
  if (inputType === "voice") return "voice";
  if (inputType === "whatsapp") return "whatsapp";
  return "manual";
}

export function classifyTimelineEventType(text: string): TimelineEventType {
  if (MED_START_PATTERN.test(text) && MEDICATION_PATTERN.test(text)) return "medication_started";
  if (MED_CHANGE_PATTERN.test(text) && MEDICATION_PATTERN.test(text)) return "medication_changed";
  if (/\b(doctor|physician|discharge|instruction|prescribed)\b/i.test(text)) return "doctor_instruction";
  if (/\b(appointment|visit|clinic|specialist)\b/i.test(text)) return "appointment";
  if (/\b(lab|test result|blood|scan|x-ray|mri)\b/i.test(text)) return "test_result";
  if (/\b(pain|symptom|confus\w*|fever|nausea|appetite|sleep)\b/i.test(text)) return "symptom_reported";
  return "care_note";
}

export function extractEntities(text: string): Record<string, string | string[] | null> {
  const entities: Record<string, string | string[] | null> = {};

  const medMatch = text.match(
    /\b(metformin|insulin|aspirin|lisinopril|atorvastatin|warfarin)\b/i,
  );
  if (medMatch) entities.medication = medMatch[0];

  const doseMatch = text.match(DOSAGE_PATTERN);
  if (doseMatch) entities.dosage = doseMatch[0].replace(/\s+/g, "");

  const symptoms: string[] = [];
  for (const m of text.matchAll(/\b(confus\w*|pain|fever|nausea|dizz\w*|appetite|sleep)\b/gi)) {
    symptoms.push(m[0].toLowerCase());
  }
  if (symptoms.length > 0) entities.symptoms = [...new Set(symptoms)];

  return entities;
}

function abstractLabel(type: TimelineEventType, entities: Record<string, string | string[] | null>): string {
  if (entities.medication && typeof entities.medication === "string") {
    const dose = entities.dosage ? ` (${entities.dosage})` : "";
    if (type === "medication_started") return `Medication started: ${entities.medication}${dose}`;
    if (type === "medication_changed") return `Medication changed: ${entities.medication}${dose}`;
  }
  if (type === "symptom_reported" && Array.isArray(entities.symptoms)) {
    return `Symptom reported: ${entities.symptoms.join(", ")}`;
  }
  const labels: Record<TimelineEventType, string> = {
    medication_started: "Medication started",
    medication_changed: "Medication changed",
    symptom_reported: "Symptom reported",
    doctor_instruction: "Doctor instruction recorded",
    appointment: "Appointment noted",
    test_result: "Test result recorded",
    care_note: "Care observation recorded",
  };
  return labels[type];
}

export function mapCanonicalToTimelineEvent(event: CanonicalCareEvent): TimelineEvent | null {
  if (event.status === "invalidated" || event.status === "superseded") return null;

  const text = event.raw_input;
  const type = classifyTimelineEventType(text);
  const extracted_entities = extractEntities(text);
  const confidence =
    event.integrity.field_confidence?.extracted_fact?.extraction === "high"
      ? 0.85
      : event.integrity.field_confidence?.extracted_fact?.extraction === "medium"
        ? 0.65
        : 0.45;

  return {
    id: `tl_${event.id}`,
    type,
    timestamp: event.timestamp,
    source: {
      channel: mapSourceChannel(event),
      raw_text: text,
      source_event_id: event.id,
    },
    extracted_entities,
    confidence,
    abstract_label: abstractLabel(type, extracted_entities),
  };
}

export function mapToRawEvent(event: CanonicalCareEvent): import("./types").RawEvent {
  return {
    id: `raw_${event.id}`,
    source_type: mapSourceChannel(event),
    raw_content: event.raw_input,
    timestamp: event.timestamp,
    canonical_event_id: event.id,
  };
}

export function normalizeDosage(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").replace(/units?$/, "unit");
}

export function normalizeMedicationName(name: string): string {
  return name.toLowerCase().trim();
}

export function semanticFactKey(type: string, name: string): string {
  return `${type}::${normalizeMedicationName(name)}`;
}
