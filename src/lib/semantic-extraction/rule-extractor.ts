/**
 * Rule-based extraction floor — deterministic, model-free structured understanding.
 *
 * Purpose: `unparsed_raw` must never be the default outcome of a capture. Whatever
 * the LLM ladder does, this module guarantees concrete, checkable facts
 * (measurements, medication actions, timing, questions, appointments,
 * caregiver capacity) are extracted from plain caregiver language.
 *
 * Boundaries (safety-boundary.ts):
 * - Records what was said. Never diagnoses, never infers cause, never triages.
 * - Negation and hedging are preserved as evidence, never resolved.
 * - No confidence theater: rule facts are marked `observed`/`reported`, not scored
 *   into a clinical claim.
 */

import type {
  CaregiverLoadSignal,
  ExtractionAppointment,
  ExtractionAttribution,
  ExtractionContradiction,
  ExtractionMedication,
  ExtractionMeasurement,
  ExtractionObservation,
  ExtractionQuestion,
  ExtractionTemporalFact,
  ExtractionUncertainty,
  SemanticExtraction,
} from "./types";
import { EXTRACTION_SCHEMA_VERSION } from "./types";
import {
  CAREGIVER_LOAD_SIGNAL_RULES,
  caregiverLoadSignals,
} from "../caregiver-capacity/caregiver-load-signals";

/** Caregiver pronouns/roles — attribution detection only. */
const SPEAKER_PATTERNS: { pattern: RegExp; person: string; role: ExtractionAttribution["role"] }[] = [
  { pattern: /\b(?:i|i'm|im|my|me|we|we're)\b/i, person: "Caregiver", role: "caregiver" },
  { pattern: /\b(mom|mother|she|her)\b/i, person: "Care recipient", role: "patient" },
  { pattern: /\b(dad|father|he|him|his)\b/i, person: "Care recipient", role: "patient" },
  { pattern: /\b(they|them|their)\b/i, person: "Care recipient", role: "patient" },
  { pattern: /\b(doctor|dr\.?|nurse|gp|clinic|therapist|carer|carer|social worker)\b/i, person: "Clinician", role: "clinician" },
  { pattern: /\b(my sister|my brother|my son|my daughter|my wife|my husband|my friend)\b/i, person: "Family", role: "family" },
];

const NEGATION = /(?:not|n't|never|hardly|barely|no longer|stopped|denies|refused|without)\b/i;
const HEDGE = /\b(?:i think|maybe|perhaps|might be|may be|could be|not sure|unsure|i guess|somewhat|sort of|possibly|probably|i don't know|don't know|dunno|unclear|maybe i'm wrong)\b/i;

function cleanSpan(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-–—]+/, "")
    .replace(/[\s,;:\-–—]+$/, "")
    .trim();
}

function sentenceUnits(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => cleanSpan(s))
    .filter((s) => s.length >= 6);
}

function attributionFor(text: string): ExtractionAttribution[] {
  const out: ExtractionAttribution[] = [];
  const seen = new Set<string>();
  for (const { pattern, person, role } of SPEAKER_PATTERNS) {
    if (!pattern.test(text)) continue;
    if (seen.has(person)) continue;
    seen.add(person);
    out.push({
      person,
      role,
      claim: cleanSpan(text).slice(0, 160),
      confidence: role === "caregiver" ? 0.8 : 0.6,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Measurements                                                        */
/* ------------------------------------------------------------------ */

type MeasurementRule = {
  type: string;
  pattern: RegExp;
  unit?: string;
  build?: (m: RegExpExecArray) => Partial<ExtractionMeasurement>;
};

const MEASUREMENT_RULES: MeasurementRule[] = [
  {
    type: "blood_pressure",
    pattern: /\b(\d{2,3})\s*(?:\/|over|out of)\s*(\d{2,3})\b/i,
    build: (m) => ({
      value: `${m[1]}/${m[2]}`,
      unit: "mmHg",
      systolic: Number(m[1]),
      diastolic: Number(m[2]),
    }),
  },
  {
    type: "heart_rate",
    pattern: /\b(?:heart rate|pulse|bpm|beats per minute)\D{0,12}(\d{2,3})\b/i,
    build: (m) => ({ value: Number(m[1]), unit: "bpm" }),
  },
  {
    type: "temperature",
    pattern: /\b(\d{2,3}(?:\.\d)?)\s*(?:°|degrees?)?\s*(?:f\b|fahrenheit|c\b|celsius)\b/i,
    build: (m) => ({ value: Number(m[1]), unit: /celsius|\bc\b/i.test(m[0]!) ? "C" : "F" }),
  },
  {
    type: "blood_glucose",
    pattern: /\b(?:glucose|sugar|blood sugar|reading)\D{0,14}(\d{2,4})\b/i,
    build: (m) => ({ value: Number(m[1]), unit: "mg/dL" }),
  },
  {
    type: "oxygen_saturation",
    pattern: /\b(?:oxygen|sat(?:uration)?|spo2)\D{0,16}(\d{2,3})\s*%?/i,
    build: (m) => ({ value: Number(m[1]), unit: "%" }),
  },
  {
    type: "weight",
    pattern: /\b(?:weighs?|weighed|weight is|weight of|now weighs?)\D{0,10}(\d{2,4}(?:\.\d)?)\s*(lbs?|pounds?|kg|kilos?)\b/i,
    build: (m) => ({ value: Number(m[1]), unit: /kg|kilo/i.test(m[2]!) ? "kg" : "lb" }),
  },
  {
    type: "weight",
    pattern: /\b(lost|gained)\s+(?:about\s+)?(\d{1,3}(?:\.\d)?)\s*(lbs?|pounds?|kg|kilos?)\b/i,
    build: (m) => ({
      value: Number(m[2]),
      unit: /kg|kilo/i.test(m[3]!) ? "kg" : "lb",
    }),
  },
  {
    type: "sleep_hours",
    pattern: /\b(?:slept|sleeping|was up|awake)\D{0,14}(\d{1,2}(?:\.\d)?)\s*(?:hours?|hrs?)\b/i,
    build: (m) => ({ value: Number(m[1]), unit: "hours" }),
  },
  {
    type: "fluid_intake",
    pattern: /\b(?:drank|drinking|had)\D{0,14}(\d{1,3}(?:\.\d)?)\s*(?:cups?|glasses?|bottles?|ml|litres?|liters?|oz)\b/i,
    build: (m) => ({ value: Number(m[1]), unit: m[2]! }),
  },
  {
    type: "food_intake",
    pattern: /\b(?:ate|has eaten|managed to eat|finished)\D{0,12}(?:about\s+|roughly\s+|around\s+)?(half|most|none|nothing|a little|some|a few bites|everything)\b/i,
    build: (m) => ({ value: m[1]!, unit: null }),
  },
  {
    type: "mobility_assistance",
    pattern: /\b(?:needed|needs?|using|walked with|got up with)\D{0,16}(a walker|walker|cane|crutches|a wheelchair|wheelchair|help|assistance|two people)\b/i,
    build: (m) => ({ value: m[1]!, unit: null }),
  },
];

function measurements(text: string): ExtractionMeasurement[] {
  const out: ExtractionMeasurement[] = [];
  const seen = new Set<string>();
  for (const rule of MEASUREMENT_RULES) {
    const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      if (m[0].length === 0) {
        global.lastIndex += 1;
        continue;
      }
      const extra = rule.build?.(m) ?? {};
      const value = extra.value ?? m[1] ?? m[0];
      const key = `${rule.type}:${String(value)}:${String(extra.unit ?? rule.unit ?? "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        type: rule.type,
        value: (value ?? "") as number | string,
        unit: extra.unit ?? rule.unit ?? null,
        systolic: extra.systolic ?? null,
        diastolic: extra.diastolic ?? null,
        time: null,
        date: null,
        temporal_precision: timePrecisionFor(text, m.index),
        source_person: /i\b|we\b/i.test(text) ? "Caregiver" : "Care recipient",
        uncertainty: HEDGE.test(text) ? "reported_with_hedge" : null,
      });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Medications                                                         */
/* ------------------------------------------------------------------ */

const MED_ACTION_RULES: { pattern: RegExp; action: NonNullable<ExtractionMedication["reported_action"]> }[] = [
  { pattern: /\b(?:gave|given|administered)\b/i, action: "administered_by_others" },
  { pattern: /\b(?:took|has taken|had her|had his|had them)\b/i, action: "taken" },
  { pattern: /\b(?:missed|skipped|didn'?t take|hasn'?t taken|forgot to take|never took)\b/i, action: "missed" },
  { pattern: /\b(?:refused|won'?t take|rejected|declined)\b/i, action: "not_taken" },
  { pattern: /\b(?:not sure|don'?t know if|maybe took|might have taken|unsure if)\b/i, action: "uncertain" },
  { pattern: /\b(?:stopped|held off|we'?ve paused|put on hold)\b/i, action: "not_taken" },
];

const MED_NAME_PATTERN =
  /\b(?:his|her|their|my|the)?\s*([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,2}|[a-z]{4,}(?:ol|one|pril|azole|tin\b|ine\b|zine\b|pine\b|mab\b|nib\b|sartan\b|statin\b))/;

/** Words that can never be a medication name. */
const NON_MED_WORDS = new Set([
  "she", "he", "they", "him", "her", "them", "this", "that", "there", "today", "yesterday",
  "morning", "evening", "night", "breakfast", "lunch", "dinner", "break", "lunchtime",
  "dose", "tablets", "tablet", "pills", "pill", "capsule", "capsules", "medication", "medicine",
  "meds", "script", "prescription", "pharmacy", "doctor", "clinic", "nurse", "hospital",
  "and", "but", "after", "before", "with", "without", "again", "still", "just", "then",
  "last", "every", "each", "since", "about", "around", "really", "very", "so", "not", "her",
  "his", "their", "my", "the", "a", "an", "it", "them", "up", "out", "in", "on", "at", "to",
]);

/**
 * Resolve the medication name from a sentence.
 * Order: explicit possessive/label, token before the dose, token after the action
 * verb, capitalised brand name. Never guesses a name that is not written.
 */
function resolveMedicationName(unit: string, dose: RegExpExecArray | null): string {
  const possessive =
    /\b(?:his|her|their|my|the)\s+([A-Za-z][A-Za-z-]{2,})(?:\s+(?:tablets?|pills?|capsules?))?(?:\s+\d|\s*$|\s+with|\s+this|\s+last|\s+today|\s+last\b)/i.exec(unit);
  if (possessive?.[1] && !NON_MED_WORDS.has(possessive[1]!.toLowerCase())) {
    return possessive[1]!.trim();
  }

  if (dose?.index !== undefined) {
    const before = unit.slice(Math.max(0, dose.index - 40), dose.index);
    const tokens = before.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? [];
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i]!;
      if (!NON_MED_WORDS.has(token.toLowerCase())) return token;
    }
  }

  const afterVerb =
    /\b(?:take|taking|took|gave|giving|given|skipped|refused|missed|swapped|stopped)\s+(?:her|his|their|my)?\s*([A-Za-z][A-Za-z-]{2,})/i.exec(
      unit,
    );
  if (afterVerb?.[1] && !NON_MED_WORDS.has(afterVerb[1]!.toLowerCase())) {
    return afterVerb[1]!.trim();
  }

  const labelled = /\b(?:medication|medicine|med|pill|tablet|dose)\s+(?:called\s+)?([A-Za-z][A-Za-z-]{2,})/i.exec(
    unit,
  );
  if (labelled?.[1] && !NON_MED_WORDS.has(labelled[1]!.toLowerCase())) {
    return labelled[1]!.trim();
  }

  const named = MED_NAME_PATTERN.exec(unit);
  if (named?.[1] && !NON_MED_WORDS.has(named[1]!.toLowerCase())) {
    return named[1].trim();
  }
  return "";
}

/** Common objects that follow a take/give verb but are never a medication. */
const NON_MED_OBJECTS = new Set([
  "walk", "walks", "walking", "shower", "bath", "bathroom", "nap", "rest", "stroll", "exercise",
  "taxi", "bus", "car", "lift", "turn", "sun", "air", "phone", "class", "sister", "message",
  "photos", "photo", "letter", "call", "seat", "coat", "shoes", "hair", "teeth", "bread",
  "space", "breath", "chance", "minute", "hour", "afternoon", "morning", "evening", "night",
]);

/** Verbs that mean something was swallowed, given, or withheld. */
const MED_ADMIN_VERB =
  /\b(?:take|took|taking|taken|given|gave|give|giving|administered|skipped|skip|refused|refuse|missed|miss|swapped|stopped|restarted|had)\b/i;

function medications(text: string): ExtractionMedication[] {
  const out: ExtractionMedication[] = [];
  const seen = new Set<string>();
  for (const unit of sentenceUnits(text)) {
    const dose = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g\b|ml|units?|tablets?|pills?)/i.exec(unit);
    // A sentence is about medication when it says so, when a dose with a unit appears,
    // or when an administration verb has a plausible medicine as its object —
    // "my sister says she skipped the metformin" carries no medication keyword at all.
    const keyword = /\b(?:medications?|medicines?|pills?|tablets?|capsules?|doses?|dosage|prescriptions?|prescribed|pharmacy|script|refill|meds)\b/i.exec(unit);
    const keywordTrigger = Boolean(keyword);
    let name = resolveMedicationName(unit, dose);
    if (name && NON_MED_OBJECTS.has(name.toLowerCase())) name = "";
    const nameLooksMedication = Boolean(name) && !NON_MED_WORDS.has(name.toLowerCase());
    const actionTrigger = MED_ADMIN_VERB.test(unit);
    if (!keywordTrigger && !dose && !(nameLooksMedication && actionTrigger)) continue;
    const freq = /\b(twice daily|three times daily|once daily|nightly|each morning|each evening|daily|weekly|bd\b|tds\b|od\b)\b/i.exec(unit);
    let action: NonNullable<ExtractionMedication["reported_action"]> | null = null;
    for (const rule of MED_ACTION_RULES) {
      if (rule.pattern.test(unit)) {
        action = rule.action;
        break;
      }
    }
    if (!name && !dose && !action && !freq) continue;
    // "She took the tablets" names the medicine only as a kind; keep the caregiver's word.
    const resolvedName = name || keyword?.[0] || "a medication not named";
    const key = `${resolvedName.toLowerCase()}|${dose?.[0] ?? ""}|${action ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: resolvedName,
      reported_action: action,
      administration_status: action === "taken" || action === "administered_by_others" ? "taken" : action === "uncertain" || action === "missed" ? "uncertain" : action ? "not_taken" : null,
      source_person: /doctor|clinic|nurse|pharmac/i.test(unit) ? "Clinician" : "Caregiver",
      temporal_context: cleanSpan(unit).slice(0, 160),
      uncertainty: HEDGE.test(unit) ? "reported_with_hedge" : null,
      note: [dose ? `${dose[1]}${dose[2]}` : null, freq ? freq[1]! : null, /increased|double|halved|stopped|restarted/i.exec(unit)?.[0]].filter(Boolean).join(" · ") || null,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Temporal facts                                                      */
/* ------------------------------------------------------------------ */

const TIME_PATTERNS: { pattern: RegExp; precision: NonNullable<ExtractionTemporalFact["precision"]> }[] = [
  { pattern: /\b(?:today|tonight|this morning|this afternoon|this evening)\b/i, precision: "approximate" },
  { pattern: /\b(?:yesterday|last night|last morning|earlier today)\b/i, precision: "approximate" },
  { pattern: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, precision: "exact" },
  { pattern: /\b(\d{1,2})\s*(?:hours?|hrs?)\s*ago\b/i, precision: "relative" },
  { pattern: /\b(\d{1,2})\s*(?:mins?|minutes?)\s*ago\b/i, precision: "relative" },
  { pattern: /\b(?:on|since|until)\s+(?:mon|tues?|wed(?:nes)?|thurs?|fri|sat(?:ur)?|sun)(?:day)?\b/i, precision: "approximate" },
  { pattern: /\bfor\s+(\d+|a few|several)\s+(day|days|week|weeks|month|months|year|years)\b/i, precision: "relative" },
  { pattern: /\b(?:since|after|following)\s+(?:the\s+)?(?:fall|hospital|discharge|visit|medication change|dose change|surgery|diagnosis)\b/i, precision: "relative" },
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/, precision: "exact" },
];

function temporalFacts(text: string): ExtractionTemporalFact[] {
  const out: ExtractionTemporalFact[] = [];
  const seen = new Set<string>();
  for (const { pattern, precision } of TIME_PATTERNS) {
    const m = pattern.exec(text);
    if (!m) continue;
    const reference = cleanSpan(m[0]);
    const key = reference.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      description: sentenceContaining(text, m.index ?? 0).slice(0, 200),
      time_reference: reference,
      date_reference: /\d{4}-\d{2}-\d{2}/.test(reference) ? reference : null,
      precision,
      ordering: /\bsince|after|following|before|until\b/i.test(reference) ? "relative_to_event" : null,
    });
    if (out.length >= 8) break;
  }
  return out;
}

function sentenceContaining(text: string, index: number): string {
  const start = Math.max(
    text.lastIndexOf(".", index),
    text.lastIndexOf("!", index),
    text.lastIndexOf("?", index),
    text.lastIndexOf("\n", index),
  );
  const endCandidates = [text.indexOf(".", index), text.indexOf("!", index), text.indexOf("?", index), text.indexOf("\n", index)];
  const end = endCandidates.filter((i) => i > -1).sort((a, b) => a - b)[0] ?? text.length;
  return cleanSpan(text.slice(start + 1, end)) || cleanSpan(text);
}

function timePrecisionFor(text: string, index: number | undefined): ExtractionMeasurement["temporal_precision"] {
  if (index === undefined) return "uncertain";
  const window = text.slice(Math.max(0, index - 40), index + 40);
  if (/\b\d{1,2}:\d{2}\s*(am|pm)\b/i.test(window)) return "exact";
  if (/\b(today|yesterday|tonight|this morning|last night)\b/i.test(window)) return "approximate";
  if (/\b(\d+)\s*(hours?|mins?|minutes?)\s*ago\b/i.test(window)) return "relative";
  return "uncertain";
}

/* ------------------------------------------------------------------ */
/*  Observations (structural, not clinical)                             */
/* ------------------------------------------------------------------ */

const OBSERVATION_RULES: { type: ExtractionObservation["type"]; pattern: RegExp }[] = [
  { type: "functional_change", pattern: /\b(?:couldn'?t|could not|wasn'?t able|not able to|difficulty|trouble)\b/i },
  { type: "functional_change", pattern: /\b(?:needed help|had to be helped|assisted|helped (?:him|her|them) (?:up|into|to))\b/i },
  { type: "behavior", pattern: /\b(?:refused|wouldn'?t|insisted|kept (?:asking|saying)|repeated|argued|hid|hoarded)\b/i },
  { type: "cognitive_change", pattern: /\b(?:confused|forgot|forgetting|didn'?t recognize|didn'?t know|memory|repeating|disoriented|where (?:he|she|they) (?:was|were))\b/i },
  { type: "mood_change", pattern: /\b(?:crying|cried|anxious|agitated|frustrated|withdrawn|irritable|calmer|upset|smiling|laughing)\b/i },
  { type: "symptom", pattern: /\b(?:pain|dizzy|nausea|short of breath|fever|cough|itching|swelling|bleeding|bruis|tingling)\b/i },
  { type: "symptom", pattern: /\b(?:didn'?t sleep|slept poorly|woke (?:up )?(?:multiple|several|every)|up all night)\b/i },
  { type: "other", pattern: /\b(?:fell|fall|slipped|tripped|collapsed)\b/i },
  { type: "other", pattern: /\b(?:hospital|clinic|appointment|discharged|admitted|home visit|paramedic|ambulance|ER)\b/i },
];

const SEVERITY_RULES: { pattern: RegExp; severity: NonNullable<ExtractionObservation["severity"]> }[] = [
  { pattern: /\b(?:couldn'?t|could not|unable to|had to carry|had to be (?:carried|helped))\b/i, severity: "severe" },
  { pattern: /\b(?:very|really|quite|a lot|terrible|awful|worse|bad)\b/i, severity: "moderate" },
  { pattern: /\b(?:a little|a bit|slightly|on and off)\b/i, severity: "mild" },
];

function observations(text: string, load: CaregiverLoadSignal[]): ExtractionObservation[] {
  const out: ExtractionObservation[] = [];
  const seen = new Set<string>();
  const loadUnits = new Set(load.map((l) => cleanSpan(l.evidence).toLowerCase()));
  for (const unit of sentenceUnits(text)) {
    const lower = unit.toLowerCase();
    if (loadUnits.has(lower)) continue;
    const rule = OBSERVATION_RULES.find((r) => r.pattern.test(unit));
    if (!rule) continue;
    const key = lower.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const severity = SEVERITY_RULES.find((s) => s.pattern.test(unit))?.severity ?? null;
    const isRecipient = /\b(?:she|he|they|him|her|mom|dad|mother|father)\b/i.test(unit);
    out.push({
      type: rule.type,
      description: unit.slice(0, 240),
      severity,
      source_person: isRecipient ? "Care recipient" : /\bi\b|\bwe\b/i.test(unit) ? "Caregiver" : null,
      source_role: isRecipient ? "patient" : /\bi\b|\bwe\b/i.test(unit) ? "caregiver" : "unknown",
      temporal_context: temporalReferenceIn(unit),
      uncertainty: HEDGE.test(unit) ? "suspected" : NEGATION.test(unit) ? "reported" : "observed",
    });
    if (out.length >= 10) break;
  }
  return out;
}

function temporalReferenceIn(unit: string): string | null {
  for (const { pattern } of TIME_PATTERNS) {
    const m = pattern.exec(unit);
    if (m) return cleanSpan(m[0]);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Questions / appointments / uncertainty                              */
/* ------------------------------------------------------------------ */

function questions(text: string): ExtractionQuestion[] {
  const out: ExtractionQuestion[] = [];
  const seen = new Set<string>();
  for (const unit of sentenceUnits(text)) {
    const isQuestion =
      /\?\s*$/.test(unit) ||
      /^(?:should|does|do|did|is|are|was|were|can|could|would|how|what|why|when|where|which|is it|has|had)\b/i.test(unit);
    if (!isQuestion) continue;
    const q = cleanSpan(unit);
    const key = q.toLowerCase().slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      question: q.slice(0, 200),
      topic: /medication|dose|pill|script/i.test(q) ? "medication" : /doctor|clinic|appointment|hospital|discharge/i.test(q) ? "care_encounter" : /eat|food|meal|drink|fluid/i.test(q) ? "intake" : /sleep|night|rest/i.test(q) ? "rest" : null,
    });
    if (out.length >= 5) break;
  }
  return out;
}

function appointments(text: string): ExtractionAppointment[] {
  const out: ExtractionAppointment[] = [];
  const seen = new Set<string>();
  for (const unit of sentenceUnits(text)) {
    if (!/\b(?:appointment|appt|clinic|doctor|gp|surgery|follow[- ]?up|physio|therapy|scan|test(?:ing)?|discharge|discharged|admitted)\b/i.test(unit)) {
      continue;
    }
    const clinician = /\b(?:dr\.?|doctor)\s+([A-Z][a-z]+)/.exec(unit)?.[1] ?? null;
    const date =
      /\b(\d{4}-\d{2}-\d{2})\b/.exec(unit)?.[1] ??
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i.exec(unit)?.[0] ??
      /\b(today|tomorrow|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(unit)?.[0] ??
      null;
    const time =
      /\b(?:at\s+)?(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i.exec(unit)?.[1]?.replace(/\s+/g, " ") ?? null;
    const key = `${clinician ?? ""}|${date ?? ""}|${time ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      clinician,
      date,
      time,
      type: /discharg|admit/i.test(unit) ? "hospital_stay" : /scan|test|blood work/i.test(unit) ? "test" : /physio|therapy/i.test(unit) ? "therapy" : /follow[- ]?up/i.test(unit) ? "follow_up" : "appointment",
      certainty: /\b(?:booked|confirmed|scheduled|appointment (?:is|was) for)\b/i.test(unit)
        ? "confirmed"
        : /\b(?:might|maybe|planning|hoping|going to|need to)\b/i.test(unit)
          ? "planned"
          : "uncertain",
      source_person: /doctor|clinic|nurse|hospital/i.test(unit) ? "Clinician" : "Caregiver",
    });
    if (out.length >= 5) break;
  }
  return out;
}

function uncertainties(text: string): ExtractionUncertainty[] {
  const out: ExtractionUncertainty[] = [];
  const seen = new Set<string>();
  for (const unit of sentenceUnits(text)) {
    if (!HEDGE.test(unit)) continue;
    const field = /\b(?:dose|medication|pill)\b/i.test(unit)
      ? "medication"
      : /\b(?:when|timing|started)\b/i.test(unit)
        ? "timing"
        : /\b(?:cause|why)\b/i.test(unit)
          ? "cause"
          : "interpretation";
    const key = `${field}:${unit.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      field,
      description: cleanSpan(unit).slice(0, 200),
      reason: HEDGE.exec(unit)?.[0] ?? null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Within-capture contradictions — both readings preserved, never resolved.
 * Cross-capture contradictions are handled by contradiction-detection-engine.
 */
function contradictions(text: string, meds: ExtractionMedication[]): ExtractionContradiction[] {
  const out: ExtractionContradiction[] = [];
  const byName = new Map<string, Set<string>>();
  for (const med of meds) {
    const key = med.name.toLowerCase();
    const actions = byName.get(key) ?? new Set<string>();
    if (med.reported_action) actions.add(med.reported_action);
    byName.set(key, actions);
  }
  for (const [name, actions] of byName) {
    if (actions.size > 1) {
      out.push({
        claim_a: `${name}: ${[...actions][0]}`,
        claim_b: `${name}: ${[...actions][1]}`,
        claim_a_source: "Caregiver",
        claim_b_source: "Caregiver",
        evidence: name,
        unresolved: true,
      });
    }
  }
  if (/\b(?:hasn't|haven'?t|never)\b[^.]{0,30}\b(?:eaten|drunk|slept|walked|spoken|gotten up)\b/i.test(text)) {
    const negated = /\b((?:hasn't|haven'?t|never|didn'?t|wasn't|isn't)\s+[^.!?]{4,80})/i.exec(text)?.[1];
    if (negated && out.length === 0) {
      out.push({
        claim_a: cleanSpan(negated),
        claim_b: "Another part of this message may describe the same activity as happening",
        claim_a_source: "Caregiver",
        claim_b_source: "Caregiver",
        evidence: cleanSpan(negated).slice(0, 120),
        unresolved: true,
      });
    }
  }
  return out;
}

/** True when the text contains nothing a rule floor could ever structure. */
export function isStructurallyEmpty(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return true;
  return (
    loadSignalCount(t) === 0 &&
    sentenceUnits(t).length === 0
  );
}

function loadSignalCount(text: string): number {
  return CAREGIVER_LOAD_SIGNAL_RULES.reduce(
    (n, { pattern }) => (pattern.test(text) ? n + 1 : n),
    0,
  );
}

/**
 * Deterministic structured extraction. Always returns a valid schema object —
 * empty arrays mean "not present in the text", never "extraction failed".
 */
export function extractWithRules(text: string): SemanticExtraction {
  const source = text.trim();
  const load = caregiverLoadSignals(source);
  const meds = medications(source);
  const temporal = temporalFacts(source);
  const obs = observations(source, load);
  const meas = measurements(source);
  const qs = questions(source);
  const appts = appointments(source);
  const unc = uncertainties(source);
  const contra = contradictions(source, meds);
  const attrs = attributionFor(source);

  const coverage = {
    observations: obs.length,
    measurements: meas.length,
    medications: meds.length,
    temporal_facts: temporal.length,
    questions: qs.length,
    appointments: appts.length,
    uncertainties: unc.length,
    contradictions: contra.length,
    attributions: attrs.length,
    caregiver_load_signals: load.length,
    has_structured_fact:
      obs.length + meas.length + meds.length + temporal.length + qs.length + appts.length + load.length > 0,
  };

  return {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    observations: obs,
    measurements: meas,
    medications: meds,
    temporal_facts: temporal,
    attributions: attrs,
    contradictions: contra,
    uncertainties: unc,
    questions: qs,
    appointments: appts,
    extraction_confidence: coverage.has_structured_fact ? 0.55 : 0.3,
    extraction_notes: coverage.has_structured_fact
      ? "Structured from the caregiver's own words (rule extraction)."
      : "No checkable fact was present in this message; wording preserved verbatim.",
    source: "rules",
    degraded: true,
    coverage,
    caregiver_load_signals: load,
  };
}
