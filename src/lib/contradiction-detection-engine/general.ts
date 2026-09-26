/**
 * General contradiction detection — disagreement is not limited to medication doses.
 *
 * The previous implementation compared dose strings inside one message and gave up.
 * In real care, the accounts that need preserving sit across events and across
 * people: a sibling who says she took the tablets and a spouse who says she did not,
 * a weight reported twice at incompatible values, "walked unaided" against "needed
 * two people", an improving and a worsening report in the same day.
 *
 * Rules of this engine:
 * - A difference across time is a **change**, not a contradiction. Only accounts close
 *   in time (same day by default) can contradict each other.
 * - Every contradiction preserves **both** accounts and never resolves them.
 * - Safety-relevant fields raise a clarification trigger; nothing is ever suppressed.
 * - Claim extraction is shared with the extraction floor, so a contradiction and the
 *   understanding of an event can never disagree with each other.
 */

import { extractWithRules } from "../semantic-extraction/rule-extractor";
import type {
  ExtractionMeasurement,
  ExtractionMedication,
} from "../semantic-extraction/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { OpenContradiction } from "./types";

/** Accounts closer together than this can contradict each other. */
const CONTRADICTION_WINDOW_HOURS = Number(process.env.CONTRADICTION_WINDOW_HOURS ?? 36);

type ClaimPolarity = "present" | "absent";

type Claim = {
  event_id: string;
  at: string;
  timestampMs: number;
  /** What kind of thing is being claimed (medication, weight, mobility, …). */
  field: string;
  /** What the claim is about (medication name, measurement type, function). */
  subject: string;
  /** Comparable value: dose string, numeric value, state name. */
  value: string;
  /** present = happened / was taken; absent = did not happen / not taken. */
  polarity: ClaimPolarity;
  /** Verbatim evidence span. */
  evidence: string;
  source_person: string | null;
};

function eventText(event: CanonicalCareEvent): string {
  const snippet = event.attributes?.source_situation_text;
  const extra = typeof snippet === "string" ? snippet : "";
  return `${event.raw_input ?? ""} ${extra}`.trim();
}

function eventTime(event: CanonicalCareEvent): number {
  const parsed = Date.parse(event.timestamp ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function claimFromEvent(event: CanonicalCareEvent): Claim[] {
  const text = eventText(event);
  if (!text) return [];
  const at = event.timestamp ?? "";
  const timestampMs = eventTime(event);
  const extraction = extractWithRules(text);
  const claims: Claim[] = [];

  const sourcePerson = (() => {
    const person = event.attributes?.source_person;
    if (typeof person === "string" && person) return person;
    return /\b(?:doctor|nurse|clinic|gp)\b/i.test(text) ? "Clinician" : "Caregiver";
  })();

  for (const med of extraction.medications) {
    const name = med.name.toLowerCase();
    const action = med.reported_action ?? "unknown";
    claims.push({
      event_id: event.id,
      at,
      timestampMs,
      field: "medication_action",
      subject: name,
      value: action,
      polarity: action === "taken" || action === "administered_by_others" ? "present" : action === "missed" || action === "not_taken" ? "absent" : "unknown" as never,
      evidence: med.temporal_context ?? med.note ?? med.name,
      source_person: med.source_person ?? sourcePerson,
    });
    const dose = doseFromNote(med);
    if (dose) {
      claims.push({
        event_id: event.id,
        at,
        timestampMs,
        field: "medication_dose",
        subject: name,
        value: dose,
        polarity: "present",
        evidence: `${med.name} ${dose}`,
        source_person: med.source_person ?? sourcePerson,
      });
    }
  }

  for (const meas of extraction.measurements) {
    const numeric = numericFrom(meas);
    if (numeric === null) continue;
    claims.push({
      event_id: event.id,
      at,
      timestampMs,
      field: `measurement:${meas.type}`,
      subject: meas.type,
      value: String(numeric),
      polarity: "present",
      evidence: `${meas.type} ${meas.value}${meas.unit ? ` ${meas.unit}` : ""}`,
      source_person: meas.source_person ?? sourcePerson,
    });
  }

  for (const state of functionStates(text)) {
    claims.push({
      event_id: event.id,
      at,
      timestampMs,
      field: "function",
      subject: state.domain,
      value: state.state,
      polarity: state.polarity,
      evidence: state.evidence,
      source_person: sourcePerson,
    });
  }

  for (const intake of intakeStates(text)) {
    claims.push({
      event_id: event.id,
      at,
      timestampMs,
      field: `intake:${intake.domain}`,
      subject: intake.domain,
      value: intake.value,
      polarity: intake.polarity,
      evidence: intake.evidence,
      source_person: sourcePerson,
    });
  }

  return claims;
}

function doseFromNote(med: ExtractionMedication): string | null {
  if (!med.note) return null;
  const m = med.note.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|units?|tablets?|pills?)/i);
  return m ? `${m[1]}${m[2]!.toLowerCase()}` : null;
}

function numericFrom(meas: ExtractionMeasurement): number | null {
  if (typeof meas.value === "number") return meas.value;
  const m = String(meas.value).match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

const FUNCTION_STATE_RULES: {
  domain: string;
  state: string;
  polarity: ClaimPolarity;
  pattern: RegExp;
}[] = [
  { domain: "walking", state: "independent", polarity: "present", pattern: /\b(?:walked|walking|walk)\b[^.!?]{0,30}\b(?:unaided|on (?:his|her|their) own|without help|independently)\b/i },
  { domain: "walking", state: "needs assistance", polarity: "present", pattern: /\b(?:needed|needs|using|with)\b[^.!?]{0,24}\b(?:a walker|the walker|frame|cane|crutches|a wheelchair|help from|assistance|two people)\b/i },
  { domain: "transfers", state: "independent", polarity: "present", pattern: /\b(?:got|getting|stand(?:ing)?|up|transferr?(?:ed|ing))\b[^.!?]{0,30}\b(?:on (?:his|her|their) own|unaided|without help|independently)\b/i },
  { domain: "transfers", state: "needs assistance", polarity: "present", pattern: /\b(?:hoist|lift|helped (?:him|her|them) (?:up|into|out)|two people to (?:move|lift)|cannot (?:stand|transfer))\b/i },
  { domain: "eating", state: "feeding self", polarity: "present", pattern: /\b(?:ate|feeding|feeds? (?:him|her|them))\b[^.!?]{0,24}\b(?:on (?:his|her|their) own|unaided|without help|independently)\b/i },
  { domain: "eating", state: "needs feeding", polarity: "present", pattern: /\b(?:spoon[- ]fed|helped (?:him|her|them) (?:eat|drink)|couldn't manage (?:to eat|food))\b/i },
  { domain: "toileting", state: "independent", polarity: "present", pattern: /\b(?:toilet|bathroom|loo|continence)\b[^.!?]{0,30}\b(?:on (?:his|her|their) own|unaided|without help|independently|accident[- ]free)\b/i },
  { domain: "toileting", state: "needs help", polarity: "present", pattern: /\b(?:pad(?:s|ded)|continence (?:pad|care)|toileting help|helped (?:him|her|them) to the (?:toilet|bathroom)|accidents?\b)/i },
];

function functionStates(text: string): { domain: string; state: string; polarity: ClaimPolarity; evidence: string }[] {
  const out: { domain: string; state: string; polarity: ClaimPolarity; evidence: string }[] = [];
  const seen = new Set<string>();
  for (const rule of FUNCTION_STATE_RULES) {
    const key = `${rule.domain}:${rule.state}`;
    if (seen.has(key)) continue;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    seen.add(key);
    out.push({ domain: rule.domain, state: rule.state, polarity: rule.polarity, evidence: m[0] });
  }
  // Negated independence: "can't walk without help" is the opposite claim.
  if (/\b(?:can'?t|couldn'?t|unable to|not able to|difficult(?:y)?) walk\b/i.test(text)) {
    out.push({
      domain: "walking",
      state: "needs assistance",
      polarity: "present",
      evidence: /\b(?:can'?t|couldn'?t|unable to|not able to|difficult(?:y)?) walk\b/i.exec(text)![0],
    });
  }
  return out;
}

const INTAKE_RULES: { domain: string; value: string; polarity: ClaimPolarity; pattern: RegExp }[] = [
  { domain: "fluids", value: "none", polarity: "absent", pattern: /\b(?:drank|had) (?:nothing|no water|not a thing)\b/i },
  { domain: "fluids", value: "some", polarity: "present", pattern: /\b(?:drank|had)\D{0,20}\b(?:cups?|glasses?|bottles?|ml|litres?)\b/i },
  { domain: "food", value: "nothing", polarity: "absent", pattern: /\b(?:ate nothing|didn'?t eat|refused (?:all )?(?:food|meals?)|no food)\b/i },
  { domain: "food", value: "some", polarity: "present", pattern: /\b(?:ate|finished|managed)\D{0,20}\b(?:half|most|some|a few bites|everything|a plate)\b/i },
];

function intakeStates(text: string): { domain: string; value: string; polarity: ClaimPolarity; evidence: string }[] {
  const out: { domain: string; value: string; polarity: ClaimPolarity; evidence: string }[] = [];
  const seen = new Set<string>();
  for (const rule of INTAKE_RULES) {
    if (seen.has(rule.domain)) continue;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    seen.add(rule.domain);
    out.push({ domain: rule.domain, value: rule.value, polarity: rule.polarity, evidence: m[0] });
  }
  return out;
}

function withinWindow(a: Claim, b: Claim): boolean {
  if (!a.timestampMs || !b.timestampMs) return true; // undated accounts: preserve both
  const hours = Math.abs(a.timestampMs - b.timestampMs) / 3_600_000;
  return hours <= CONTRADICTION_WINDOW_HOURS;
}

const SAFETY_FIELDS = new Set([
  "medication_action",
  "medication_dose",
  "function",
  "measurement:oxygen_saturation",
  "measurement:blood_glucose",
  "measurement:blood_pressure",
]);

function affectsSafety(field: string): boolean {
  return SAFETY_FIELDS.has(field);
}

function isMeasurementConflict(field: string, valueA: string, valueB: string): boolean {
  const a = Number(valueA);
  const b = Number(valueB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (field === "measurement:blood_pressure") {
    return Math.abs(a - b) >= 40;
  }
  if (field === "measurement:weight") {
    return Math.abs(a - b) >= 5;
  }
  if (field === "measurement:sleep_hours") {
    return Math.abs(a - b) >= 3;
  }
  if (field === "measurement:temperature") {
    return Math.abs(a - b) >= 1.5;
  }
  return Math.abs(a - b) > 0 && /^(?:blood_glucose|oxygen_saturation|heart_rate|fluid_intake)$/.test(
    field.replace("measurement:", ""),
  )
    ? Math.abs(a - b) / Math.max(a, b, 1) >= 0.25
    : false;
}

function describe(field: string, subject: string): string {
  switch (field) {
    case "medication_action":
      return `whether ${subject} was taken`;
    case "medication_dose":
      return `the dose of ${subject}`;
    case "function":
      return `${subject} support`;
    case "intake:food":
      return "what was eaten";
    case "intake:fluids":
      return "what was drunk";
    default:
      return subject.replace(/_/g, " ");
  }
}

function messageFor(a: Claim, b: Claim, field: string, subject: string): string {
  const subjectText = describe(field, subject);
  const aText = polarityText(a);
  const bText = polarityText(b);
  const sources = a.source_person && b.source_person && a.source_person !== b.source_person
    ? ` (${a.source_person} and ${b.source_person} each reported this differently)`
    : "";
  return `Two different records of ${subjectText}: ${aText} and ${bText}${sources}. Both are held until it is settled.`;
}

function polarityText(claim: Claim): string {
  switch (claim.field) {
    case "medication_action":
      return claim.value === "taken" || claim.value === "administered_by_others"
        ? `${claim.subject} was taken`
        : claim.value === "missed"
          ? `${claim.subject} was missed`
          : claim.value === "not_taken"
            ? `${claim.subject} was not taken`
            : `${claim.subject} was uncertain`;
    case "medication_dose":
      return `${claim.value}`;
    case "function":
      return `${claim.subject}: ${claim.value}`;
    default:
      return `${claim.value}`;
  }
}

function clarificationFor(field: string, subject: string): string | null {
  switch (field) {
    case "medication_action":
      return `Which is right about ${subject} today — taken or not taken? Both are held until you say.`;
    case "medication_dose":
      return `There are two different doses recorded for ${subject}. Which dose is current?`;
    case "function":
      return `Two different levels of help with ${subject} are recorded. What was true most recently?`;
    case "measurement:oxygen_saturation":
    case "measurement:blood_glucose":
    case "measurement:blood_pressure":
      return `Two different ${subject.replace(/_/g, " ")} readings are recorded for the same time. Which reading was measured?`;
    default:
      return null;
  }
}

/**
 * Detect contradictions across all events.
 * Returns empty when accounts agree or when differences are simply changes over time.
 */
export function detectGeneralContradictions(
  events: readonly CanonicalCareEvent[],
): {
  contradictions: OpenContradiction[];
  clarification_triggers: string[];
  claims_examined: number;
} {
  const claims: Claim[] = [];
  for (const event of events) {
    claims.push(...claimFromEvent(event));
  }

  const contradictions: OpenContradiction[] = [];
  const triggers: string[] = [];
  const groups = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (claim.polarity === ("unknown" as never)) continue;
    const key = `${claim.field}::${claim.subject}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(claim);
    groups.set(key, bucket);
  }

  for (const [key, bucket] of groups) {
    if (bucket.length < 2) continue;
    const [field, subject] = key.split("::") as [string, string];
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i]!;
        const b = bucket[j]!;
        if (a.event_id === b.event_id) continue;
        if (!withinWindow(a, b)) continue;

        let conflict = false;
        if (a.polarity !== b.polarity) {
          conflict = true;
        } else if (field === "medication_dose" || field.startsWith("measurement:")) {
          conflict = a.value !== b.value && (field.startsWith("measurement:")
            ? isMeasurementConflict(field, a.value, b.value)
            : true);
        } else if (field === "function" || field.startsWith("intake:")) {
          conflict = a.value !== b.value;
        }
        if (!conflict) continue;

        const contradictionId = `con_general_${a.event_id}_${b.event_id}_${field}_${subject}`.replace(/[^a-zA-Z0-9_]/g, "_");
        if (contradictions.some((c) => c.contradiction_id === contradictionId)) continue;

        contradictions.push({
          contradiction_id: contradictionId,
          field,
          event_ids: [a.event_id, b.event_id],
          both_preserved: true,
          shared_message: messageFor(a, b, field, subject),
          affects_safety: affectsSafety(field),
        });

        const trigger = clarificationFor(field, subject);
        if (trigger && affectsSafety(field) && !triggers.includes(trigger)) {
          triggers.push(trigger);
        }
      }
    }
  }

  return { contradictions, clarification_triggers: triggers, claims_examined: claims.length };
}

/**
 * Contradictions inside a single message (both readings kept).
 * Used at capture time, before cross-event history exists.
 */
export function detectWithinMessageContradictions(text: string): OpenContradiction[] {
  const extraction = extractWithRules(text);
  if (extraction.contradictions.length === 0) return [];
  return extraction.contradictions.map((c, index) => ({
    contradiction_id: `con_msg_${index}_${c.claim_a}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80),
    field: c.claim_a.split(":")[0]?.trim() || "claim",
    event_ids: [] as string[],
    both_preserved: true as const,
    shared_message: `Two different accounts in the same message: ${c.claim_a} and ${c.claim_b}. Both are held.`,
    affects_safety: /medication|dose|medicine|pill/i.test(`${c.claim_a} ${c.claim_b}`),
  }));
}
