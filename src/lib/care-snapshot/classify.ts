import type { CareEventType } from "./types";

const MEDICATION_KEYWORDS =
  /\b(medication|medicine|med|meds|pill|pills|dose|dosage|prescription|tablet|capsule|insulin|antibiotic)\b/i;

const SYMPTOM_KEYWORDS =
  /\b(headache|pain|fever|nausea|dizzy|dizziness|fatigue|tired|cough|swelling|symptom|ache|vomiting|shortness of breath|appetite)\b/i;

const TASK_KEYWORDS =
  /\b(missed|forgot|forgotten|skipped|didn't take|did not take|reminder|appointment|visit|task|checkup)\b/i;

const IMPROVEMENT_KEYWORDS =
  /\b(better|improved|improving|recovering|appetite returned|more active|feeling good)\b/i;

const DETERIORATION_KEYWORDS =
  /\b(worse|worsening|declining|reduced appetite|less active|weaker|deteriorat)\b/i;

export function classifyEventType(text: string): CareEventType {
  const lower = text.toLowerCase();
  const hasMed = MEDICATION_KEYWORDS.test(lower);
  const hasMissed = TASK_KEYWORDS.test(lower);

  if (hasMissed && hasMed) return "medication";
  if (hasMissed) return "task";
  if (hasMed) return "medication";
  if (SYMPTOM_KEYWORDS.test(lower)) return "symptom";
  return "observation";
}

export function isMissedMedication(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    TASK_KEYWORDS.test(lower) &&
    (MEDICATION_KEYWORDS.test(lower) || /\b(morning|evening|night)\b/.test(lower))
  );
}

export function extractSymptomKeywords(text: string): string[] {
  const matches = text.toLowerCase().match(
    /\b(headache|pain|fever|nausea|dizziness|fatigue|cough|swelling|ache|vomiting|appetite)\b/g,
  );
  return matches ?? [];
}

export function hasDeteriorationSignal(text: string): boolean {
  return DETERIORATION_KEYWORDS.test(text);
}

export function hasImprovementSignal(text: string): boolean {
  return IMPROVEMENT_KEYWORDS.test(text);
}

export function hasConcernLanguage(text: string): boolean {
  return /\b(worried|concern|unsure|uncertain|not sure|anxious|scared|need to check)\b/i.test(
    text,
  );
}

export function hasFollowUpLanguage(text: string): boolean {
  return /\b(call doctor|see doctor|schedule visit|follow up|follow-up|check with|contact provider)\b/i.test(
    text,
  );
}

export function typeLabel(type: CareEventType): string | undefined {
  if (type === "unknown" || type === "observation") return undefined;
  return type;
}
