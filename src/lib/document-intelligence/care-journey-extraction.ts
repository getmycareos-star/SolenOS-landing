import type {
  AppointmentInfo,
  CareInstruction,
  CareJourneyUnderstanding,
  CarePerson,
  MedicalEvent,
  MedicationInfo,
  SolenOSDocument,
} from "./types";
import { buildCaregiverPrioritization } from "./prioritization";

/**
 * CARE JOURNEY EXTRACTION — Extract the *care implications* in a document so the
 * document can update the person's care journey, not just be stored.
 *
 * Extraction is verbatim + observational only. SolenOS never validates a
 * medication, assumes a dose, confirms a diagnosis, or decides care. Every
 * returned insight carries its source text (evidence traceability) and any
 * ambiguity is surfaced as an uncertainty at a higher layer.
 */

const DATE_MARKER =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/gi;

const TIMEFRAME_MARKER =
  /\b(?:within|in|by)\s+(\d+)\s*(?:days?|weeks?|months?|hours?)\b|\bnext\s+(?:week|month)\b|\b(?:by|before)\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/gi;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

function firstDate(sentence: string): string | null {
  const m = sentence.match(DATE_MARKER);
  return m ? m[0] : null;
}

function firstTimeframe(sentence: string): string | null {
  const m = sentence.match(TIMEFRAME_MARKER);
  return m ? m[0] : null;
}

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

// ─── Medical events ─────────────────────────────────────────────────────────
const HOSPITAL_MARKER = /\b(?:admitted to|hospitalized|hospital visit|hospital stay|admission|ED)\b/i;
const DIAGNOSIS_MARKER = /\b(?:diagnos(?:is|ed)|new diagnosis|diagnosed with)\b/i;
const PROCEDURE_MARKER = /\b(?:procedure|surgery|operation|outpatient procedure|performed)\b/i;
const DISCHARGE_MARKER = /\b(?:discharge|discharged|released from hospital|discharge summary)\b/i;
const PROVIDER_INSTRUCTION_MARKER =
  /\b(?:instructed|the doctor instructed|per provider|counseled|recommended by)\b/i;

function extractMedicalEvents(
  text: string,
  sourceType: SolenOSDocument,
): MedicalEvent[] {
  const events: MedicalEvent[] = [];
  for (const sentence of sentences(text)) {
    if (DISCHARGE_MARKER.test(sentence)) {
      events.push({ kind: "discharge", sourceText: sentence, date: firstDate(sentence) ?? undefined });
    } else if (HOSPITAL_MARKER.test(sentence)) {
      events.push({ kind: "hospital_visit", sourceText: sentence, date: firstDate(sentence) ?? undefined });
    } else if (DIAGNOSIS_MARKER.test(sentence)) {
      events.push({ kind: "diagnosis", sourceText: sentence, date: firstDate(sentence) ?? undefined });
    } else if (PROCEDURE_MARKER.test(sentence)) {
      events.push({ kind: "procedure", sourceText: sentence, date: firstDate(sentence) ?? undefined });
    } else if (PROVIDER_INSTRUCTION_MARKER.test(sentence)) {
      events.push({ kind: "provider_instruction", sourceText: sentence, date: firstDate(sentence) ?? undefined });
    }
  }
  if (sourceType !== "medical_document" && sourceType !== "care_plan") return [];
  return unique(events, (e) => e.sourceText.toLowerCase());
}

// ─── Medications ────────────────────────────────────────────────────────────
const MEDICATION_NAME_TAKE =
  /\b(?:take|takes|taking|prescribed|prescription|start|started|increase|decrease|adjust|continue|discontinue|stop|change|reduced|increased)\s+([A-Z][a-zA-Z]{1,40}(?:\s+[a-z][a-zA-Z]{1,40})?)\b/gi;
const MEDICATION_LINE = /\b([A-Z][a-zA-Z]{2,40})\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units?|g)\b/gi;
const DOSE_MARKER = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units?|g)\b/gi;
const FREQUENCY_MARKER =
  /\b(?:once|twice|three times|daily|every day|every\s+\d+\s*hours?|Q\s?\d+[hH]?|at bedtime|at night|with meals|on an empty stomach|before meals|after meals|as needed|PRN|twice a day|once a day|BID|TID)\b/gi;
const DISCONTINUE_MARKER = /\b(?:discontinue|stop taking|stopped|no longer take|cease)\b/i;
const NEW_MARKER = /\b(?:new|start|started|begin|now on|addition|added|introduced)\b/i;
const CHANGED_MARKER = /\b(?:change|changed|increase|decrease|adjust|increase to|decrease to|reduce|increase|go from|was on)\b/i;
const REFILL_MARKER = /\b(?:refill|renew|renewal)\b/i;
const CONCERN_MARKER =
  /\b(?:concern|side effect|adverse|interaction|watch for|allergy|allergic)\b/i;
// High-priority medication safety signals — surfaced for care coordination.
const DUPLICATE_DOSE_MARKER =
  /\b(?:duplicate|taken twice|both\s+.*\s+(?:say|list)|listed\s+(?:twice|more than once)|same dose\s+twice)\b/i;
const MISSED_DOSE_MARKER =
  /\b(?:missed dose|missed a dose|missed the dose|forgot.to take|skipped a dose|did not take|missed taking)\b/i;
const REFILL_PROBLEM_MARKER =
  /\b(?:refill\s+(?:problem|issue|delayed|not (?:available|filled|approved))|out of\s+.*refill|refill\s+denied|unable to (?:refill|get the refill)|pharmacy\s+(?:could not|couldn'?t)\s+fill)\b/i;
const UNCLEAR_INSTRUCTIONS_MARKER =
  /\b(?:unclear (?:instructions?|directions?|dosing)|instructions?\s+(?:unclear|not clear|confusing)|not sure (?:how|when|how often) to (?:take|give)|dose unclear|directions?\s+unclear)\b/i;
const MED_UNCERTAINTY_MARKER =
  /\b(?:not sure (?:which|what|if) (?:medication|med|medicine|drug)|which medication|current medications?\s+(?:unclear|unknown|uncertain|not listed)|medication list\s+(?:needs|unclear)|unsure about (?:the )?(?:current )?medications?\b|can'?t remember (?:the )?(?:name|what) (?:of the )?(?:medication|med|medicine))\b/i;

function buildMedicationNames(sentence: string): string[] {
  const names: string[] = [];
  for (const m of sentence.matchAll(MEDICATION_NAME_TAKE)) {
    if (m[1]) names.push(m[1]);
  }
  for (const m of sentence.matchAll(MEDICATION_LINE)) {
    if (m[1]) names.push(m[1]);
  }
  return [...new Set(names.map((n) => n.trim()))];
}

function extractMedications(text: string, sourceType: SolenOSDocument): MedicationInfo[] {
  if (sourceType !== "medical_document" && sourceType !== "care_plan") return [];
  const meds: MedicationInfo[] = [];
  for (const sentence of sentences(text)) {
    const names = buildMedicationNames(sentence);
    if (names.length === 0) continue;
    let status: MedicationInfo["status"] = "unknown";
    if (DISCONTINUE_MARKER.test(sentence)) status = "discontinued";
    else if (NEW_MARKER.test(sentence)) status = "new";
    else if (CHANGED_MARKER.test(sentence)) status = "dosage_changed";
    else if (/\b(?:continue|continue taking|stay on)\b/i.test(sentence)) status = "continuing";

    for (const name of names) {
      const existing = meds.find((m) => m.name.toLowerCase() === name.toLowerCase());
      const dose = sentence.match(DOSE_MARKER)?.[0];
      const frequency = sentence.match(FREQUENCY_MARKER)?.[0];
const info: MedicationInfo = {
        name,
        status,
        ...(dose ? { dose } : {}),
        ...(frequency ? { frequency } : {}),
        instructions: [],
        refill: REFILL_MARKER.test(sentence) ? sentence.slice(0, 160) : undefined,
        concern: CONCERN_MARKER.test(sentence) ? sentence.slice(0, 160) : undefined,
        duplicateDose: DUPLICATE_DOSE_MARKER.test(sentence) || undefined,
        missedDose: MISSED_DOSE_MARKER.test(sentence) || undefined,
        refillProblem: REFILL_PROBLEM_MARKER.test(sentence) || undefined,
        unclearInstructions: UNCLEAR_INSTRUCTIONS_MARKER.test(sentence) || undefined,
        uncertainty: MED_UNCERTAINTY_MARKER.test(sentence) || undefined,
        sourceText: [sentence],
      };
      if (existing) {
        // Merge — never decide a single winner. Preserve both readings.
        existing.sourceText.push(sentence);
        if (dose && !existing.dose) existing.dose = dose;
        if (frequency && !existing.frequency) existing.frequency = frequency;
        existing.instructions = [...(existing.instructions ?? []), sentence];
      } else {
        meds.push(info);
      }
    }
  }
  return unique(meds, (m) => m.name.toLowerCase());
}

// ─── Appointments & follow-ups ──────────────────────────────────────────────
const FOLLOW_UP_MARKER =
  /\b(?:follow-?up|follow up|recheck|return visit|next visit|check.?up)\b/i;
const SPECIALIST_MARKER =
  /\b(?:referral|referred to|specialist|see\s+(?:a|the)\s+c:?\s*|cardiology|neurology|oncology)\b/i;
const UPCOMING_MARKER =
  /\b(?:scheduled|appointment|booked|please schedule|upcoming visit|attend)\b/i;
const DEADLINE_MARKER = /\b(?:deadline|due by|must.*by|no later than|by [A-Z]\w+ \d{1,2})\b/i;
const TIMEFRAME_WITHIN = /\b(?:within|in|by)\s+\d+\s*(?:days?|weeks?|months?)\b/i;
const FAMILY_DISCUSSION_MARKER =
  /\b(?:family discussion|family meeting|care conference|talk with the family|discuss with (?:the )?family|family call)\b/i;
const PLANNED_DECISION_MARKER =
  /\b(?:care decision|planned (?:decision|care)|decide (?:whether|on|about)|decision needed|we will decide|plan to decide|decision meeting)\b/i;
const PREPARATION_MARKER =
  /\b(?:bring|prepare|have (?:the|your|their)|gather|ready)\s+(?:questions?|notes?|list|medications?|records?|paperwork|information)\b/i;

function appointmentWho(sentence: string): string | undefined {
  const doc = sentence.match(/\b(?:Dr\.?|Doctor|physician)\s+([A-Z][a-zA-Z.'\- ]{1,40})/i);
  if (doc?.[1]) return doc[1].trim();
  const specialist = sentence.match(
    /\b(cardiologist|neurologist|oncologist|pulmonologist|gastroenterologist|surgeon|specialist)\b/i,
  );
  if (specialist?.[0]) return specialist[0].toLowerCase();
  if (/\bpharmacy\b/i.test(sentence)) return "the pharmacy";
  const hospital = sentence.match(/Hospital(?:\s+Medical Center)?|Medical Center|Clinic|Clin(?:ic|c)/i);
  if (hospital?.[0]) return hospital[0].trim();
  return undefined;
}

function appointmentWhat(sentence: string, kind: AppointmentInfo["kind"]): string {
  const strip =
    /^(?:please\s+)?(?:schedule|book|attend|follow up|follow-up|recheck|return visit|see|refer(?:red)?)\s+/i;
  const cleaned = sentence.replace(/\s+/g, " ").replace(strip, "").trim();
  switch (kind) {
    case "deadline":
      return `Deadline / required by: ${cleaned}`;
    case "specialist_referral":
      return `Specialist referral / follow-up: ${cleaned}`;
    case "recommended_follow_up":
      return `Follow-up: ${cleaned}`;
    case "family_discussion":
      return `Family discussion about care: ${cleaned}`;
    case "planned_care_decision":
      return `Planned care decision: ${cleaned}`;
    case "upcoming_visit":
      return `Appointment / visit: ${cleaned}`;
  }
}

function appointmentPreparation(sentence: string): string | undefined {
  if (PREPARATION_MARKER.test(sentence)) {
    return "Information, notes, or questions may need to be prepared beforehand.";
  }
  return undefined;
}

function extractAppointments(text: string, sourceType: SolenOSDocument): AppointmentInfo[] {
  if (sourceType !== "medical_document" && sourceType !== "care_plan") return [];
  const apps: AppointmentInfo[] = [];
  for (const sentence of sentences(text)) {
    let kind: AppointmentInfo["kind"] | null = null;
    if (FAMILY_DISCUSSION_MARKER.test(sentence)) kind = "family_discussion";
    else if (PLANNED_DECISION_MARKER.test(sentence)) kind = "planned_care_decision";
    else if (SPECIALIST_MARKER.test(sentence)) kind = "specialist_referral";
    else if (DEADLINE_MARKER.test(sentence)) kind = "deadline";
    else if (FOLLOW_UP_MARKER.test(sentence)) kind = "recommended_follow_up";
    else if (UPCOMING_MARKER.test(sentence)) kind = "upcoming_visit";
    if (!kind) continue;
    apps.push({
      kind,
      description: sentence,
      what: appointmentWhat(sentence, kind),
      who: appointmentWho(sentence),
      timeframe: firstTimeframe(sentence) ?? undefined,
      preparation: appointmentPreparation(sentence),
      sourceText: sentence,
    });
  }
  return unique(apps, (a) => a.sourceText.toLowerCase());
}

// ─── Care instructions (restrictions, monitoring, warning signs, actions) ──
const RESTRICTION_MARKER = /\b(?:restrict|no\s+(?:driving|alcohol|lifting|exercise)|avoid|do not|limit)\b/i;
const MONITOR_MARKER = /\b(?:monitor|observe|watch for|check\s+(?:for|the)|track\s+(?:the|your|their))\b/i;
const WARNING_SIGN_MARKER =
  /\b(?:warning signs?|call\s+(?:the\s+)?doctor\s+if|seek\s+medical|red flags?|if\s+you\s+notice|go to the ER|contact your provider if)\b/i;
const RECOMMENDED_ACTION_MARKER =
  /\b(?:recommended|advised|should\s+follow|suggest|encouraged|seek|call the office|schedule)\b/i;

function extractCareInstructions(text: string, sourceType: SolenOSDocument): CareInstruction[] {
  if (sourceType !== "medical_document" && sourceType !== "care_plan") return [];
  const instructions: CareInstruction[] = [];
  for (const sentence of sentences(text)) {
    const isWarning = WARNING_SIGN_MARKER.test(sentence);
    const isMonitoring = MONITOR_MARKER.test(sentence);
    const isRestriction = RESTRICTION_MARKER.test(sentence);
    const isRecommended = RECOMMENDED_ACTION_MARKER.test(sentence);

    // Warning signs and monitoring are distinct — a sentence like
    // "Monitor X daily and call the doctor if Y" is genuinely both.
    if (isWarning) {
      instructions.push({ kind: "warning_sign", description: sentence, sourceText: sentence });
    }
    if (isMonitoring) {
      instructions.push({ kind: "monitoring_requirement", description: sentence, sourceText: sentence });
    }
    if (!isWarning && !isMonitoring && isRestriction) {
      instructions.push({ kind: "restriction", description: sentence, sourceText: sentence });
    }
    if (!isWarning && !isMonitoring && !isRestriction && isRecommended) {
      instructions.push({ kind: "recommended_action", description: sentence, sourceText: sentence });
    }
  }
  return unique(instructions, (i) => `${i.kind}|${i.sourceText.toLowerCase()}`);
}

// ─── People & organizations ─────────────────────────────────────────────────
const DOCTOR_MARKER = /\b(?:Dr\.?|Doctor|physician)\s+([A-Z][a-zA-Z.'\- ]{1,40})/;
const SPECIALIST_PERSON_MARKER =
  /\b(?:cardiologist|neurologist|oncologist|pulmonologist|gastroenterologist|surgeon|specialist)\b/i;
const HOSPITAL_NAME_MARKER =
  /\b((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+)?Hospital(?:\s+Medical Center)?|Medical Center|Clin(?:ic|c))\b/i;
const PHARMACY_MARKER = /\b([A-Z][a-zA-Z.'\- ]{1,40}\s+Pharmacy|\bthe pharmacy\b)\b/i;

function extractPeople(text: string, sourceType: SolenOSDocument): CarePerson[] {
  const people: CarePerson[] = [];
  for (const sentence of sentences(text)) {
    const fromName = sentence.match(new RegExp(DOCTOR_MARKER.source, "i"));
    if (fromName?.[1]) {
      const name = fromName[1].trim();
      const role: CarePerson["role"] = SPECIALIST_PERSON_MARKER.test(sentence)
        ? "specialist"
        : "doctor";
      people.push({ name, role, sourceText: sentence });
    }
    const hosp = sentence.match(new RegExp(HOSPITAL_NAME_MARKER.source, "i"));
    if (hosp?.[0] && /\b(?:discharge|admitted|hospital|clinic)\b/i.test(sentence)) {
      people.push({ name: hosp[0].trim(), role: "hospital", sourceText: sentence });
    }
    const pharm = sentence.match(new RegExp(PHARMACY_MARKER.source, "i"));
    if (pharm?.[0]) {
      people.push({ name: pharm[0].trim(), role: "pharmacy", sourceText: sentence });
    }
  }
  return unique(people, (p) => p.name.toLowerCase());
}

/** Aggregate care-journey understanding for a document (observational only). */
export function extractCareJourneyUnderstanding(
  text: string,
  sourceType: SolenOSDocument,
): CareJourneyUnderstanding {
  const understanding = {
    medicalEvents: extractMedicalEvents(text, sourceType),
    medications: extractMedications(text, sourceType),
    appointments: extractAppointments(text, sourceType),
    careInstructions: extractCareInstructions(text, sourceType),
    people: extractPeople(text, sourceType),
    whatChanged: [],
    uncertainties: [],
    caregiverTranslation: [],
    timelineEvents: [],
  };
return {
    ...understanding,
    prioritization: buildCaregiverPrioritization(understanding as unknown as CareJourneyUnderstanding),
  };
}

