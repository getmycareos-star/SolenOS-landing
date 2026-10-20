import type {
  CareContext,
  CareInput,
  Condition,
  InterpretedState,
  Interpretation,
  Medication,
  Person,
} from "./domain/types";
import { AMBIGUITY_THRESHOLD } from "./domain/types";

const FILLER =
  /\b(um+|uh+|i'm so worried|i'm scared|i don't know what to do|help me|please|i feel like|honestly|literally)\b/gi;
const EMOTIONAL =
  /\b(terrified|panicking|freaking out|devastated|hopeless|guilty|ashamed|overwhelmed)\b/gi;

function extractSignal(text: string): string {
  return text
    .replace(FILLER, "")
    .replace(EMOTIONAL, "")
    .replace(/\b(completely|really|very|so)\s+/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const patterns: { re: RegExp; label: string }[] = [
    { re: /\b(mom|mother|dad|father|parent|patient)\b/i, label: "patient" },
    { re: /\b(doctor|physician|nurse|specialist)\b/i, label: "healthcare provider" },
    { re: /\b(medication|med|pill|prescription|dose)\b/i, label: "medication" },
    { re: /\b(hospital|discharge|er\b|emergency)\b/i, label: "hospital event" },
    { re: /\b(sister|brother|family|sibling)\b/i, label: "family member" },
  ];
  for (const { re, label } of patterns) {
    if (re.test(text) && !entities.includes(label)) entities.push(label);
  }
  return entities;
}

function buildContext(text: string): CareContext {
  const context: CareContext = {};
  const lower = text.toLowerCase();

  // Never silently assign Mom/Dad/mother/father from note keywords (identity Locked A).
  // Ask-once display_name owns caregiver-facing labels; engine context stays role-only.
  if (/\b(patient|parent|mom|mother|dad|father|care recipient)\b/i.test(text)) {
    context.patient = { role: "patient" };
  }

  if (/\b(i'm|i am|myself|caregiver)\b/i.test(lower)) {
    context.caregiver = { role: "caregiver" };
  }

  const conditions: Condition[] = [];
  if (/\b(dementia|alzheimer|confus)\b/i.test(text)) {
    conditions.push({ name: "cognitive concern", certainty: "mentioned" });
  }
  if (/\b(fell|fall|injur)\b/i.test(text)) {
    conditions.push({ name: "fall/injury concern", certainty: "mentioned" });
  }
  if (conditions.length > 0) context.conditions = conditions;

  const medications: Medication[] = [];
  if (/\b(new medication|medication|prescription|pill|dose)\b/i.test(text)) {
    medications.push({ name: "medication mentioned", certainty: "uncertain" });
  }
  if (medications.length > 0) context.medications = medications;

  return context;
}

function ambiguityScore(text: string): number {
  let score = 0;
  if (/\b(not sure|unclear|don't understand|confus|uncertain|mixed up)\b/i.test(text)) score += 0.4;
  if (/\b(maybe|might|possibly|i think)\b/i.test(text)) score += 0.2;
  if (text.split(/\?/).length > 2) score += 0.15;
  if (text.length < 40) score += 0.2;
  return Math.min(score, 1);
}

function normalizeMeaning(signal: string, facts: string[]): string {
  if (facts.length > 0) return facts.slice(0, 3).join(" ");
  return signal.slice(0, 400) || "Caregiving situation described without clear factual details.";
}

/**
 * RAW_INPUT_STATE → INTERPRETED_STATE
 * Transforms raw input into meaning. Flags uncertainty explicitly.
 */
export function interpret(input: CareInput): InterpretedState {
  const signal = extractSignal(input.raw_text);
  const facts = signal
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const ambiguity = ambiguityScore(input.raw_text);
  const uncertain = ambiguity > AMBIGUITY_THRESHOLD;

  const interpretation: Interpretation = {
    meaning: normalizeMeaning(signal, facts),
    entities: extractEntities(input.raw_text),
    uncertainty_flags: uncertain,
  };

  if (uncertain) {
    interpretation.meaning +=
      " Some details remain unclear from the description provided.";
  }

  return {
    interpretation,
    context: buildContext(input.raw_text),
    uncertain_elements: uncertain,
    signal_text: signal,
  };
}

export function toCareInput(
  rawText: string,
  source: CareInput["source"] = "user_note",
): CareInput {
  return {
    raw_text: rawText,
    source,
    timestamp: Date.now(),
  };
}
