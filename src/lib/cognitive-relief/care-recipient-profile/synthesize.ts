import type { CareRecipientProfileData, CareTeamMember, KeyDate } from "../types";

const CONDITION_PATTERNS = [
  /\b(dementia|alzheimer|parkinson|diabetes|heart failure|copd|stroke|cancer|arthritis)\b/i,
  /\b(hypertension|high blood pressure|kidney disease|ms|multiple sclerosis)\b/i,
];

const MED_PATTERNS = [
  /\b(taking|on|prescribed|medication|medicine)\s+([a-z][a-z0-9-]{2,}(?:\s+[a-z0-9-]+)?)/gi,
  /\b(\d+\s*mg)\s+([a-z][a-z0-9-]+)/gi,
];

const AGE_PATTERN = /\b(?:age|aged|\b)(\d{2,3})\b/i;
const NAME_PATTERNS = [
  /\b(?:my\s+)?(mother|father|mom|dad|grandmother|grandma|grandfather|grandpa|husband|wife|spouse)\b/i,
  /\b(?:for|about)\s+([A-Z][a-z]+)\b/,
];

const POA_PATTERN = /\b(poa|power of attorney)\b/i;
const DOCTOR_PATTERN = /\b(dr\.?\s+[A-Z][a-z]+|doctor\s+[A-Z][a-z]+)/i;

function uniquePush(arr: string[], value: string, max = 30): void {
  const v = value.trim();
  if (!v || arr.some((x) => x.toLowerCase() === v.toLowerCase())) return;
  arr.push(v);
  if (arr.length > max) arr.shift();
}

function extractBasics(content: string, existing: string): string {
  if (existing.trim()) return existing;
  const age = content.match(AGE_PATTERN)?.[1];
  const relation = content.match(NAME_PATTERNS[0])?.[1];
  if (relation && age) return `Care recipient: ${relation}, age ${age}`;
  if (relation) return `Care recipient: ${relation}`;
  return existing;
}

function extractConditions(content: string, existing: string[]): string[] {
  const next = [...existing];
  for (const re of CONDITION_PATTERNS) {
    const m = content.match(re);
    if (m?.[0]) uniquePush(next, m[0].toLowerCase());
  }
  return next;
}

function extractMedications(content: string, existing: string[]): string[] {
  const next = [...existing];
  for (const re of MED_PATTERNS) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(content)) !== null) {
      const snippet = m[0].trim().slice(0, 80);
      uniquePush(next, snippet);
    }
  }
  return next;
}

function extractKeyDates(content: string, existing: KeyDate[], now: string): KeyDate[] {
  const next = [...existing];
  if (POA_PATTERN.test(content) && !next.some((k) => /poa/i.test(k.label))) {
    next.push({ label: "POA established", date: now.slice(0, 10) });
  }
  return next;
}

function extractCareTeam(content: string, existing: CareTeamMember[]): CareTeamMember[] {
  const next = [...existing];
  const doc = content.match(DOCTOR_PATTERN)?.[0];
  if (doc && !next.some((m) => m.name.toLowerCase() === doc.toLowerCase())) {
    next.push({ name: doc, role: "physician", contact: "" });
  }
  return next;
}

/** Merge new entry signals into profile — system synthesizes; caregiver corrects later. */
export function synthesizeProfileFromEntry(
  profile: CareRecipientProfileData,
  content: string,
  now = new Date().toISOString(),
): CareRecipientProfileData {
  return {
    care_recipient_basics: extractBasics(content, profile.care_recipient_basics),
    known_conditions: extractConditions(content, profile.known_conditions),
    current_medications: extractMedications(content, profile.current_medications),
    key_dates: extractKeyDates(content, profile.key_dates, now),
    care_team: extractCareTeam(content, profile.care_team),
    tagged_event_log: profile.tagged_event_log,
    location_index: profile.location_index,
  };
}

/** Detect location mentions for optional auto-hint (caregiver confirms separately). */
export function detectLocationHints(content: string): string[] {
  const hints: string[] = [];
  if (/\bpoa\b/i.test(content)) hints.push("POA paperwork");
  if (/\b(insurance card|insurance policy)\b/i.test(content)) hints.push("Insurance cards");
  if (/\b(medication list|pill organizer)\b/i.test(content)) hints.push("Medication list");
  return hints;
}
