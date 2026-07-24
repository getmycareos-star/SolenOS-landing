import type { CareEvent } from "./types";
import {
  hasConcernLanguage,
  hasFollowUpLanguage,
  isMissedMedication,
} from "./classify";
import { extractSymptomKeywords } from "./classify";

function hasUnresolvedSymptoms(timeline: CareEvent[]): boolean {
  const symptomCounts = new Map<string, number>();
  for (const event of timeline) {
    for (const keyword of extractSymptomKeywords(event.description)) {
      symptomCounts.set(keyword, (symptomCounts.get(keyword) ?? 0) + 1);
    }
  }
  return symptomCounts.size > 0;
}

export function synthesizeCareNotes(
  timeline: CareEvent[],
  rawTexts: string[],
): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();

  const addNote = (note: string) => {
    const key = note.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      notes.push(note);
    }
  };

  if (timeline.some((e) => isMissedMedication(e.description))) {
    addNote("Encourage medication adherence tracking");
  }

  if (hasUnresolvedSymptoms(timeline)) {
    addNote("Monitor symptom progression");
  }

  for (const text of rawTexts) {
    if (hasConcernLanguage(text)) {
      const cleaned = text.trim().replace(/\.$/, "");
      addNote(`Caregiver concern: ${cleaned}`);
    }
  }

  for (const text of rawTexts) {
    if (hasFollowUpLanguage(text)) {
      addNote("Follow-up with care provider may be needed");
      break;
    }
  }

  return notes.slice(0, 5);
}
