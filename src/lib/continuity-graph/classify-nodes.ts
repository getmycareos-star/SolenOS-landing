import type { JourneyEventType } from "../care-journey-graph/types";
import type { ContinuityDomain, UniversalNodeType } from "./types";

const DOMAIN_FROM_CATEGORY: Record<string, ContinuityDomain> = {
  medical: "care",
  legal: "legal",
  financial: "financial",
  administrative: "administrative",
  family: "family",
  caregiving: "care",
};

const EVENT_TYPE_TO_NODE: Record<JourneyEventType, UniversalNodeType> = {
  diagnosis: "Condition",
  medication_started: "Action",
  medication_stopped: "Action",
  symptom: "Condition",
  behaviour_change: "Condition",
  appointment: "Event",
  doctor_recommendation: "Obligation",
  lab_result: "Event",
  hospital_visit: "Event",
  fall: "Event",
  emergency_visit: "Event",
  caregiver_observation: "Condition",
  question: "Obligation",
  decision: "Decision",
  legal_document: "Document",
  care_goal: "Obligation",
  family_conversation: "Event",
  insurance_update: "Resource",
  administrative: "Obligation",
  other: "Event",
};

export function domainFromCategory(category: string): ContinuityDomain {
  return DOMAIN_FROM_CATEGORY[category] ?? "mixed";
}

export function nodeTypeFromJourneyEvent(eventType: JourneyEventType): UniversalNodeType {
  return EVENT_TYPE_TO_NODE[eventType] ?? "Event";
}

export function inferDomainFromText(text: string): ContinuityDomain {
  const t = text.toLowerCase();
  if (/\b(poa|attorney|legal|will|trust|guardianship)\b/.test(t)) return "legal";
  if (/\b(insurance|payment|debt|billing|claim|benefits|medicare)\b/.test(t)) return "financial";
  if (/\b(family|sibling|daughter|caregiver responsibility)\b/.test(t)) return "family";
  if (/\b(appointment|hospital|medication|symptom|fall|diagnosis)\b/.test(t)) return "care";
  if (/\b(forms|intake|schedule|referral|administrative)\b/.test(t)) return "administrative";
  return "mixed";
}

export function obligationFromText(text: string): boolean {
  return /\b(must|shall|required|follow[- ]?up|deadline|pending|due|obligation)\b/i.test(text);
}

export function constraintFromText(text: string): boolean {
  return /\b(cannot|blocked|denied|not covered|restricted|unable|limitation)\b/i.test(text);
}
