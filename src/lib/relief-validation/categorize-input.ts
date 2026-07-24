import type { InputCategory } from "./constants";

/** Organizational input category only — not behavioral profiling. */
export function categorizeInput(input: string): InputCategory {
  const text = input.toLowerCase();
  if (/\b(medication|medicine|pill|dose|prescription|meds)\b/.test(text)) {
    return "medication";
  }
  if (/\b(pain|symptom|breathing|eating|fever|headache|nausea|unhappy)\b/.test(text)) {
    return "symptom";
  }
  if (/\b(appointment|schedule|doctor|visit|provider|clinic)\b/.test(text)) {
    return "care_coordination";
  }
  return "general";
}
