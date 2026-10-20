import type { EventLogCategory, TaggedEventLogEntry } from "../types";

const SYMPTOM_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(confus\w*|disorient\w*|forget\w*|memory)\b/i, tag: "confusion" },
  { pattern: /\b(pain|ache|hurt|sore)\b/i, tag: "pain" },
  { pattern: /\b(fever|temperature|chills)\b/i, tag: "fever" },
  { pattern: /\b(dizzy|dizziness|balance)\b/i, tag: "dizziness" },
  { pattern: /\b(nausea|vomit|appetite)\b/i, tag: "digestive" },
  { pattern: /\b(sleep|insomnia|restless|tired|fatigue)\b/i, tag: "sleep_fatigue" },
  { pattern: /\b(agitat|anxious|mood|depress)\b/i, tag: "mood_change" },
  { pattern: /\b(wander|elopement|lost)\b/i, tag: "wandering" },
];

const INCIDENT_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(fell|fall|fallen|tripped|slipped)\b/i, tag: "fall" },
  { pattern: /\b(electrical|fire|gas|hazard|unsafe)\b/i, tag: "safety_hazard" },
  { pattern: /\b(mice|rodent|infestation)\b/i, tag: "pest" },
  { pattern: /\b(hospital|er|emergency|911)\b/i, tag: "emergency_visit" },
];

const DECISION_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(medication|prescription|dose|started|stopped|changed)\b/i, tag: "medication_change" },
  { pattern: /\b(poa|power of attorney|legal)\b/i, tag: "legal_decision" },
  { pattern: /\b(moved|relocate|facility|nursing home)\b/i, tag: "living_arrangement" },
  { pattern: /\b(hired|aide|helper|backup)\b/i, tag: "care_support" },
];

function extractFromPatterns(
  text: string,
  patterns: { pattern: RegExp; tag: string }[],
  category: EventLogCategory,
  rawEntryId: string,
  date: string,
): TaggedEventLogEntry[] {
  const entries: TaggedEventLogEntry[] = [];
  const seen = new Set<string>();
  for (const { pattern, tag } of patterns) {
    if (pattern.test(text) && !seen.has(tag)) {
      seen.add(tag);
      entries.push({ category, tag, date, raw_entry_id: rawEntryId });
    }
  }
  return entries;
}

/** Auto-tag symptoms, incidents, and decisions at write time — caregiver does not tag. */
export function autoTagEntry(
  content: string,
  rawEntryId: string,
  date = new Date().toISOString(),
): TaggedEventLogEntry[] {
  const text = content.trim();
  if (!text) return [];

  return [
    ...extractFromPatterns(text, SYMPTOM_TAGS, "symptom", rawEntryId, date),
    ...extractFromPatterns(text, INCIDENT_TAGS, "incident", rawEntryId, date),
    ...extractFromPatterns(text, DECISION_TAGS, "decision", rawEntryId, date),
  ];
}

export function mergeUniqueTags(
  existing: TaggedEventLogEntry[],
  incoming: TaggedEventLogEntry[],
): TaggedEventLogEntry[] {
  const seen = new Set(existing.map((e) => `${e.category}:${e.tag}:${e.date.slice(0, 10)}`));
  const merged = [...existing];
  for (const entry of incoming) {
    const key = `${entry.category}:${entry.tag}:${entry.date.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }
  return merged.slice(-500);
}
