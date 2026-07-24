import { INPUT_MODES } from "./contract-constants";

/** Explicit emergency surface signals only — no implied urgency. */
export const CRISIS_URGENT_SIGNALS = [
  /\bcannot breathe\b/i,
  /\bcan'?t breathe\b/i,
  /\bchest pain\b/i,
  /\bunconscious\b/i,
  /\bpassed out\b/i,
  /\bsevere bleeding\b/i,
  /\bimmediate danger\b/i,
  /\bneed (?:to call )?911\b/i,
  /\bnot breathing\b/i,
  /\bblue lips\b/i,
  /\binability to wake\b/i,
  /\bcan'?t wake\b/i,
] as const;

/** Explicit medical document framing — NOT casual symptoms alone. */
export const MEDICAL_DOCUMENT_SIGNALS = [
  /\blab results?\b/i,
  /\bprescription\b/i,
  /\bdischarge (?:summary|note|instructions)\b/i,
  /\bmedication list\b/i,
  /\bradiology report\b/i,
  /\bpathology report\b/i,
  /\bclinical note\b/i,
  /\bHbA1c\b/i,
  /\bCBC results?\b/i,
  /\bmedical record\b/i,
  /\bpatient summary\b/i,
] as const;

export const ADMINISTRATIVE_LEGAL_SIGNALS = [
  /\binsurance claim\b/i,
  /\bbilling statement\b/i,
  /\beligibility (?:form|letter)\b/i,
  /\blegal form\b/i,
  /\bpolicy language\b/i,
  /\bprior authorization\b/i,
  /\bcoverage determination\b/i,
  /\bclaim denial\b/i,
] as const;

export const EMOTIONAL_NARRATIVE_SIGNALS = [
  /\boverwhelmed\b/i,
  /\bconfused\b/i,
  /\bdon'?t know what to do\b/i,
  /\bscared\b/i,
  /\bterrified\b/i,
  /\bexhausted\b/i,
  /\bstressed\b/i,
  /\buncertain\b/i,
  /\bi'?m not sure\b/i,
  /\bcan'?t cope\b/i,
  /\bso worried\b/i,
] as const;

export const CLASSIFIER_FORBIDDEN_OUTPUT_KEYS = [
  "explanation",
  "reasoning",
  "diagnosis",
  "interpretation",
  "narrative",
  "summary",
  "intent",
] as const;

export const InputModeSchemaValues = INPUT_MODES;
