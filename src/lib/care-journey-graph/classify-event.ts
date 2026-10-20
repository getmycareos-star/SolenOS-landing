import type { JourneyEventType } from "./types";

const FALL = /\b(fell|fall|fallen|tripped|slipped)\b/i;
const ER = /\b(er\b|emergency room|emergency visit|ambulance|911)\b/i;
const HOSPITAL = /\b(hospital|admitted|admission|discharge)\b/i;
const MED_START = /\b(started|began|prescribed|new medication|started on)\b/i;
const MED_STOP = /\b(stopped|discontinued|no longer taking|weaned off)\b/i;
const MED = /\b(medications?|medicine|prescription|antibiotics?|dose|mg|pill)\b/i;
const SYMPTOM = /\b(pain|fever|confus\w*|dizz\w*|nausea|appetite|weak|tired|symptom)\b/i;
const BEHAVIOUR = /\b(agitat\w*|wander\w*|behavio\w*|confus\w*|memory)\b/i;
const APPT = /\b(appointment|doctor visit|clinic|specialist|neurolog)\b/i;
const RECOMMEND = /\b(recommended|advised|suggested|prescribed|follow.up|referral)\b/i;
const LAB = /\b(lab result|blood test|x-ray|xray|scan|mri|ct scan)\b/i;
const DIAGNOSIS = /\b(diagnosed|diagnosis|uti|infection|fracture|dementia|alzheimer)\b/i;
const LEGAL = /\b(power of attorney|poa|will|trust|legal document|attorney)\b/i;
const INSURANCE = /\b(insurance|medicare|medicaid|benefits|coverage|claim)\b/i;
const FAMILY = /\b(family meeting|family conversation|sister|brother|discussed with family)\b/i;
const GOAL = /\b(care goal|plan to|we need to|goal is)\b/i;
const DECISION = /\b(decided|decision|agreed|chose)\b/i;
const QUESTION = /\?|^(what|when|why|how|should|is it)\b/i;

export function classifyJourneyEventType(content: string): JourneyEventType {
  const text = content.trim();
  if (!text) return "other";
  if (ER.test(text)) return "emergency_visit";
  if (HOSPITAL.test(text)) return "hospital_visit";
  if (FALL.test(text)) return "fall";
  if (LAB.test(text)) return "lab_result";
  if (DIAGNOSIS.test(text)) return "diagnosis";
  if (MED.test(text) && MED_STOP.test(text)) return "medication_stopped";
  if (MED.test(text) && MED_START.test(text)) return "medication_started";
  if (MED.test(text)) return "medication_started";
  if (LEGAL.test(text)) return "legal_document";
  if (INSURANCE.test(text)) return "insurance_update";
  if (FAMILY.test(text)) return "family_conversation";
  if (GOAL.test(text)) return "care_goal";
  if (DECISION.test(text)) return "decision";
  if (RECOMMEND.test(text)) return "doctor_recommendation";
  if (APPT.test(text)) return "appointment";
  if (BEHAVIOUR.test(text)) return "behaviour_change";
  if (SYMPTOM.test(text)) return "symptom";
  if (QUESTION.test(text)) return "question";
  return "caregiver_observation";
}

export const EVENT_TYPE_LABELS: Record<JourneyEventType, string> = {
  diagnosis: "Diagnosis",
  medication_started: "Medication started",
  medication_stopped: "Medication stopped",
  symptom: "Symptom",
  behaviour_change: "Behaviour change",
  appointment: "Appointment",
  doctor_recommendation: "Doctor recommendation",
  lab_result: "Lab result",
  hospital_visit: "Hospital visit",
  fall: "Fall",
  emergency_visit: "Emergency visit",
  caregiver_observation: "Caregiver observation",
  question: "Question",
  decision: "Decision",
  legal_document: "Legal document",
  care_goal: "Care goal",
  family_conversation: "Family conversation",
  insurance_update: "Insurance update",
  administrative: "Administrative",
  other: "Other",
};

function categoryForType(type: JourneyEventType): string {
  if (["legal_document"].includes(type)) return "legal";
  if (["insurance_update"].includes(type)) return "financial";
  if (["family_conversation"].includes(type)) return "family";
  if (["administrative"].includes(type)) return "administrative";
  if (["care_goal", "decision", "caregiver_observation", "question"].includes(type)) return "caregiving";
  if (
    [
      "diagnosis",
      "medication_started",
      "medication_stopped",
      "symptom",
      "behaviour_change",
      "appointment",
      "doctor_recommendation",
      "lab_result",
      "hospital_visit",
      "fall",
      "emergency_visit",
    ].includes(type)
  ) {
    return "medical";
  }
  return "other";
}

export function journeyCategoryFromType(type: JourneyEventType): string {
  return categoryForType(type);
}

export function inferClinicalImportance(type: JourneyEventType, content: string): "high" | "moderate" | "low" | "informational" {
  if (["fall", "emergency_visit", "diagnosis"].includes(type)) return "high";
  if (/\b(severe|critical|911|unresponsive|not breathing)\b/i.test(content)) return "high";
  if (["medication_started", "medication_stopped", "hospital_visit", "symptom", "behaviour_change"].includes(type)) {
    return "moderate";
  }
  if (["legal_document", "insurance_update", "care_goal", "decision"].includes(type)) return "informational";
  return "low";
}
