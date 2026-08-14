/**
 * Structured Care Signals — deterministic extraction of typed entities from caregiver text.
 *
 * This module preserves concrete information that the generic extraction layer collapses:
 *   medications, dosages, symptoms, measurements, food/intake, sleep, appointments,
 *   providers, facilities, locations, dates, times, durations, frequencies, uncertainty,
 *   and source attribution.
 *
 * Every signal retains its source fragment and temporal precision.
 * Signals are NOT inferred — they are extracted directly from the text.
 */

export type SignalKind =
  | "medication"
  | "dosage"
  | "symptom"
  | "measurement"
  | "measurement_value"
  | "food_intake"
  | "sleep"
  | "appointment"
  | "provider"
  | "facility"
  | "location"
  | "date"
  | "time"
  | "duration"
  | "frequency"
  | "uncertainty"
  | "source"
  | "task"
  | "observation"
  | "event"
  | "question"
  | "family_logistical";

export type TemporalPrecision = "exact" | "approximate" | "relative" | "unknown";

export type CareSignal = {
  id: string;
  kind: SignalKind;
  subject?: string;
  value?: string;
  normalizedValue?: string;
  unit?: string;
  timestamp?: string;
  temporalPrecision: TemporalPrecision;
  certainty: "explicit" | "uncertain" | "inferred";
  sourceText: string;
  sourceId: string;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function matchOne(pattern: RegExp, text: string): string | null {
  const m = text.match(pattern);
  return m ? m[0]!.trim() : null;
}

function matchAll(pattern: RegExp, text: string): string[] {
  const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
  return Array.from(matches, (m) => m[0]!.trim());
}

const MED_PATTERNS = [
  /\b(?:lisinopril|metformin|insulin|atorvastatin|omeprazole|amlodipine|metoprolol|gabapentin|hydrochlorothiazide|losartan|simvastatin|levothyroxine|amlodipine|prednisone|azithromycin|amoxicillin|ciprofloxacin|fluoxetine|sertraline|escitalopram|trazodone|alprazolam|lorazepam|clonazepam|zolpidem|tamsulosin|oxycodone|hydrocodone|morphine|fentanyl|docusate|senna|polyethylene glycol| lactulose|acetaminophen|ibuprofen|naproxen|aspirin|warfarin|apixaban|rivaroxaban|clopidogrel|carvedilol|furosemide|spironolactone|potassium chloride|ferrous sulfate|vitamin d|calcium|magnesium|zinc|melatonin|diphenhydramine|guaifenesin|dextromethorphan|pseudoephedrine|cetirizine|loratadine|fexofenadine|fluticasone|budesonide|montelukast|tiotropium|salbutamol|albuterol)\b/gi,
  /\b(?:blood pressure|bp|heart rate|hr|temperature|temp|oxygen|spo2|o2 sat|respiratory rate|rr|pulse|glucose|bg|blood sugar|a1c|hba1c|weight|bmi|height|pain scale|falls?|wound|sore|bruise|swelling|edema|rash|hives|blister|infection|uti|pneumonia|bronchitis|asthma|copd|chf|congestive heart failure|ckd|esrd|dialysis|stroke|cva|tia|seizure|epilepsy|parkinson|alzheimer|dementia|diabetes|hypertension|hypotension|arrhythmia|afib|atrial fibrillation|bradycardia|tachycardia)\b/gi,
  /\b(?:my\s+\w+|her\s+\w+|his\s+\w+|their\s+\w+)\s+(?:medication|medicine|meds?|prescription|rx|dose|pill|tablet|capsule|liquid|injection|patch|cream|ointment|inhaler|nebulizer)\b/gi,
];

const DOSAGE_PATTERNS = [
  /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|cc|units?|iu|tabs?|caps?|puffs?|drops?|patches?|mg\/ml|mcg\/ml|mcg\/h)\b/gi,
  /\b(?:once|twice|three times|four times|daily|weekly|monthly|every\s+\d+\s+(?:hours?|days?|weeks?|months?)|as needed|prn|q\d+h|bid|tid|qid|ac|pc|hs|am|pm)\b/gi,
];

const SYMPTOM_PATTERNS = [
  /\b(?:dizziness|dizzy|lightheaded|faint|nausea|vomiting|vomit|diarrhea|constipation|bloating|gas|heartburn|acid reflux|shortness of breath|sob|wheezing|cough|congestion|runny nose|sore throat|hoarseness|headache|migraine|confusion|confused|disoriented|memory loss|forgetting|repeating questions|wandering|agitation|aggressive|anxious|anxiety|depressed|sad|lonely|frustrated|irritable|restless|insomnia|sleeping too much|fatigue|tired|weak|tremor|shaking|numbness|tingling|pain|ache|soreness|cramp|stiffness|swelling|bruising|bleeding|rash|itchy|fever|chills|sweating|appetite loss|not eating|overeating|thirst|dry mouth|urinary|incontinence|constipation|diarrhea|dizzy when standing|orthostatic|fall|fell|fallen|slipped|tripped|stumbled|fainted|syncope)\b/gi,
];

const MEASUREMENT_PATTERNS = [
  /\b(?:bp|blood pressure)\s+\d{2,3}\s*\/\s*\d{2,3}\b/gi,
  /\b\d{2,3}\s*\/\s*\d{2,3}\s*(?:mmhg|mm Hg)?\b/gi,
  /\b(?:temp|temperature)\s+\d{2,3}(?:\.\d+)?\s*(?:°?[fc]|degrees?)\b/gi,
  /\b\d{2,3}(?:\.\d+)?\s*(?:°?[fc]|degrees?|mmhg|bpm|mg\/dl|mmol\/l|g\/dl|kg|lbs?|pounds?|oz|inches?|cm|m|feet|stone|lb)\b/gi,
  /\b(?:weight|height|bmi|glucose|blood sugar|a1c|spo2|o2 sat|respiratory rate|rr|pulse|hr)\s*:?\s*\d+(?:\.\d+)?\s*(?:mg\/dl|mmol\/l|bpm|%|kg|lbs?|pounds?|oz|cm|m|feet|stone|lb)?\b/gi,
];

const FOOD_PATTERNS = [
  /\b(?:ate|eating|food|meal|breakfast|lunch|dinner|snack|appetite|hungry|full|refused to eat|not eating|overeating|picky eater|drinking|fluids|water|juice|milk|coffee|tea|soft food|pureed|thickened liquids|aspiration|choking|coughing while eating)\b/gi,
];

const SLEEP_PATTERNS = [
  /\b(?:sleep|sleeping|slept|insomnia|woke up|waking|nighttime|nap|napping|restless sleep|sleepwalking|sundowning|fatigued|tired|exhausted|oversleeping|sleeping too much|early morning|late night|bedtime|woke at)\b/gi,
];

const APPOINTMENT_PATTERNS = [
  /\b(?:appointment|follow[- ]?up|clinic|doctor visit|checkup|consultation|assessment|evaluation|therapy|pt|ot|st|speech therapy|occupational therapy|physical therapy|home care|visiting nurse|social worker|pharmacist|dentist|optometrist|audiologist|specialist|cardiologist|neurologist|psychiatrist|geriatrician|palliative|hospice)\b/gi,
];

const PROVIDER_PATTERNS = [
  /\b(?:dr\.?|doctor|nurse|np|pa|physician|therapist|counselor|social worker|aide|caregiver|cna|home health|palliative|hospice)\s+(?:[\w]+(?:\s[\w]+){0,2})\b/gi,
  /\b(?:[\w]+(?:\s[\w]+){0,2})\s+(?:md|do|rn|lpn|csw|pt|ot|st|np|pa)\b/gi,
];

const FACILITY_PATTERNS = [
  /\b(?:hospital|clinic|urgent care|emergency room|er|rehab|skilled nursing|snf|assisted living|memory care|nursing home|hospice|home health|outpatient|inpatient|day program|adult day care|respite|palliative care)\b/gi,
];

const LOCATION_PATTERNS = [
  /\b(?:at\s+(?:the\s+)?(?:hospital|clinic|home|nursing home|assisted living|rehab|urgent care|er|doctor|dentist|pharmacy|park|mall|store|restaurant|church|temple|mosque|community center|senior center))\b/gi,
];

const DATE_PATTERNS = [
  /\b(?:yesterday|today|tomorrow|last\s+(?:night|week|month|year)|this\s+(?:morning|afternoon|evening|night|week|month)|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?\b/gi,
  /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/gi,
];

const TIME_PATTERNS = [
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi,
  /\b(?:morning|afternoon|evening|night|midnight|noon|lunchtime|dinnertime|bedtime)\b/gi,
];

const DURATION_PATTERNS = [
  /\b(?:for\s+)?(?:\d+)\s+(?:days?|weeks?|months?|years?|hours?|minutes?)\b/gi,
  /\b(?:several|few|a\s+couple\s+of)\s+(?:days?|weeks?|months?|hours?)\b/gi,
  /\b(?:since|for|over\s+the\s+last)\s+(?:yesterday|today|last\s+\w+|this\s+\w+|\d+\s+\w+)\b/gi,
];

const FREQUENCY_PATTERNS = [
  /\b(?:daily|weekly|monthly|every\s+(?:day|week|month|morning|afternoon|evening|night|other day|few days)|once\s+(?:a|per)\s+(?:day|week|month)|twice\s+(?:a|per)\s+(?:day|week|month)|three\s+times\s+(?:a|per)\s+(?:day|week|month)|as needed|prn|on\s+demand|irregularly|sporadically|consistently|regularly|off\s+and\s+on)\b/gi,
];

const UNCERTAINTY_PATTERNS = [
  /\b(?:i\s+think|i'm\s+not\s+sure|maybe|possibly|might\s+have|probably|perhaps|uncertain|unclear|not\s+sure|don'?t\s+know|don'?t\s+remember|forgot|hard\s+to\s+tell|guess|guess(?:ing)?|assuming|assumed|seems?\s+like|appears?\s+to\s+be|could\s+be|would\s+be)\b/gi,
];

const TASK_PATTERNS = [
  /\b(?:need\s+to|has\s+to|should|must|will\s+need\s+to|scheduled\s+to|going\s+to|plan(?:ning)?\s+to|arrange|arranged|set\s+up|organize|remind|reminder|call|call\s+(?:the\s+)?(?:doctor|clinic|pharmacy)|pick\s+up|drop\s+off|fill\s+(?:prescription|rx)|refill|refill(?:ing)?)\b/gi,
];

const FAMILY_LOGISTICS_PATTERNS = [
  /\b(?:my\s+(?:brother|sister|son|daughter|wife|husband|partner|cousin|aunt|uncle|niece|nephew|grandchild|grandparent|in[- ]law|family|relative)|brother|sister|son|daughter|wife|husband|partner|family\s+member|relative|next[- ]?of[- ]?kin)\b/gi,
  /\b(?:power\s+of\s+attorney|poa|healthcare\s+proxy|advance\s+directive|living\s+will|dnr|do\s+not\s+resuscitate|code\s+status|guardian|conservator|legal|paperwork|forms?|insurance|medicare|medicaid|va\s+benefits|social\s+security|disability|ssi|ssdi|hospice\s+benefit|waiver|managed\s+care)\b/gi,
];

export function extractStructuredSignals(params: {
  rawText: string;
  sourceId: string;
}): CareSignal[] {
  const { rawText, sourceId } = params;
  const text = rawText.trim();
  if (text.length < 4) return [];

  const signals: CareSignal[] = [];
  const seen = new Set<string>();

  function push(kind: SignalKind, value: string, opts: Partial<CareSignal> = {}): void {
    const key = `${kind}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push({
      id: newId(`sig_${kind}`),
      kind,
      sourceId,
      temporalPrecision: "unknown",
      certainty: "explicit",
      sourceText: opts.sourceText ?? text,
      ...opts,
      value,
    });
  }

  function pushWithTemporal(kind: SignalKind, value: string, text: string): void {
    const temporal = extractTemporalPrecision(text);
    const certainty = extractCertainty(text);
    push(kind, value, { temporalPrecision: temporal, certainty, sourceText: text });
  }

  // Medications
  for (const m of matchAll(MED_PATTERNS[0]!, text)) {
    if (/\b(?:blood pressure|bp|heart rate|hr|temperature|temp)\b/i.test(m)) continue;
    pushWithTemporal("medication", m, text);
  }

  // Dosages
  for (const d of matchAll(DOSAGE_PATTERNS[0]!, text)) {
    pushWithTemporal("dosage", d, text);
  }
  for (const f of matchAll(DOSAGE_PATTERNS[1]!, text)) {
    pushWithTemporal("frequency", f, text);
  }

  // Symptoms
  for (const s of matchAll(SYMPTOM_PATTERNS[0]!, text)) {
    pushWithTemporal("symptom", s, text);
  }

  // Measurements
  for (const m of matchAll(MEASUREMENT_PATTERNS[0]!, text)) {
    pushWithTemporal("measurement", m, text);
  }
  for (const m of matchAll(MEASUREMENT_PATTERNS[1]!, text)) {
    pushWithTemporal("measurement_value", m, text);
  }
  for (const m of matchAll(MEASUREMENT_PATTERNS[2]!, text)) {
    pushWithTemporal("measurement", m, text);
  }
  for (const m of matchAll(MEASUREMENT_PATTERNS[3]!, text)) {
    pushWithTemporal("measurement", m, text);
  }

  // Food / intake
  for (const f of matchAll(FOOD_PATTERNS[0]!, text)) {
    pushWithTemporal("food_intake", f, text);
  }

  // Sleep
  for (const s of matchAll(SLEEP_PATTERNS[0]!, text)) {
    pushWithTemporal("sleep", s, text);
  }

  // Appointments
  for (const a of matchAll(APPOINTMENT_PATTERNS[0]!, text)) {
    pushWithTemporal("appointment", a, text);
  }

  // Providers
  for (const p of matchAll(PROVIDER_PATTERNS[0]!, text)) {
    pushWithTemporal("provider", p, text);
  }
  for (const p of matchAll(PROVIDER_PATTERNS[1]!, text)) {
    pushWithTemporal("provider", p, text);
  }

  // Facilities
  for (const f of matchAll(FACILITY_PATTERNS[0]!, text)) {
    pushWithTemporal("facility", f, text);
  }

  // Locations
  for (const l of matchAll(LOCATION_PATTERNS[0]!, text)) {
    pushWithTemporal("location", l, text);
  }

  // Dates
  for (const d of matchAll(DATE_PATTERNS[0]!, text)) {
    pushWithTemporal("date", d, text);
  }
  for (const d of matchAll(DATE_PATTERNS[1]!, text)) {
    pushWithTemporal("date", d, text);
  }
  for (const d of matchAll(DATE_PATTERNS[2]!, text)) {
    pushWithTemporal("date", d, text);
  }

  // Times
  for (const t of matchAll(TIME_PATTERNS[0]!, text)) {
    pushWithTemporal("time", t, text);
  }
  for (const t of matchAll(TIME_PATTERNS[1]!, text)) {
    pushWithTemporal("time", t, text);
  }

  // Durations
  for (const d of matchAll(DURATION_PATTERNS[0]!, text)) {
    pushWithTemporal("duration", d, text);
  }
  for (const d of matchAll(DURATION_PATTERNS[1]!, text)) {
    pushWithTemporal("duration", d, text);
  }
  for (const d of matchAll(DURATION_PATTERNS[2]!, text)) {
    pushWithTemporal("duration", d, text);
  }

  // Uncertainties
  for (const u of matchAll(UNCERTAINTY_PATTERNS[0]!, text)) {
    pushWithTemporal("uncertainty", u, text);
  }

  // Tasks
  for (const t of matchAll(TASK_PATTERNS[0]!, text)) {
    pushWithTemporal("task", t, text);
  }

  // Family / logistical
  for (const f of matchAll(FAMILY_LOGISTICS_PATTERNS[0]!, text)) {
    pushWithTemporal("family_logistical", f, text);
  }
  for (const f of matchAll(FAMILY_LOGISTICS_PATTERNS[1]!, text)) {
    pushWithTemporal("family_logistical", f, text);
  }

  return signals.slice(0, 40);
}

function extractTemporalPrecision(text: string): TemporalPrecision {
  const lower = text.toLowerCase();
  if (/\bexactly\b|\bprecisely\b|\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(lower)) return "exact";
  if (/\bapproximately\b|\babout\b|\baround\b|\broughly\b|\b~/.test(lower)) return "approximate";
  if (/\byesterday|today|tomorrow|last\s+\w+|this\s+\w+|next\s+\w+|since|for\s+\d+|over\s+the\s+last|ago\b/.test(lower)) return "relative";
  return "unknown";
}

function extractCertainty(text: string): "explicit" | "uncertain" | "inferred" {
  const lower = text.toLowerCase();
  if (/\bi\s+think\b|\bi'm\s+not\s+sure\b|\bmaybe\b|\bpossibly\b|\bmight\b|\bprobably\b|\bperhaps\b|\buncertain\b|\bunclear\b|\bnot\s+sure\b|\bdon'?t\s+know\b|\bdon'?t\s+remember\b|\bforgot\b|\bguess(?:ing)?\b|\bseems?\s+like\b|\bappears?\s+to\s+be\b|\bcould\s+be\b|\bwould\s+be\b/.test(lower)) return "uncertain";
  if (/\bappears?\b|\blikely\b|\bprobably\b|\bmay\b|\bmight\b/.test(lower)) return "uncertain";
  return "explicit";
}

export function signalsToCaregiverLines(signals: CareSignal[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const s of signals) {
    const prefix = s.certainty === "uncertain" ? "Possibly: " : "";
    const line = `${prefix}${s.value}`;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (line.length >= 4 && line.length <= 120) {
      lines.push(line.endsWith(".") ? line : `${line}.`);
    }
  }

  return lines.slice(0, 8);
}

export function signalsToCaregiverFacts(signals: CareSignal[]): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();

  for (const s of signals) {
    if (s.certainty === "uncertain" || !s.value) continue;
    const key = s.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const line = s.value;
    if (line.length >= 4 && line.length <= 120) {
      facts.push(line.endsWith(".") ? line : `${line}.`);
    }
  }

  return facts.slice(0, 6);
}

export function uncertaintySignals(signals: CareSignal[]): string[] {
  return signals
    .filter((s) => s.certainty === "uncertain" && s.value)
    .map((s) => s.value!)
    .filter((v) => v.length >= 4)
    .slice(0, 4);
}
