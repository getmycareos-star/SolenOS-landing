import type { CareEvent } from "./types";
import {
  extractSymptomKeywords,
  hasDeteriorationSignal,
  hasImprovementSignal,
  isMissedMedication,
} from "./classify";

export function extractKeyObservations(
  timeline: CareEvent[],
  rawTexts: string[],
): string[] {
  const observations: string[] = [];
  const allText = [...timeline.map((e) => e.description), ...rawTexts].join(
    " ",
  );

  const missedMedCount = timeline.filter((e) =>
    isMissedMedication(e.description),
  ).length;

  if (missedMedCount >= 1) {
    observations.push("At least one missed medication event");
  }

  const symptomCounts = new Map<string, number>();
  for (const event of timeline) {
    for (const keyword of extractSymptomKeywords(event.description)) {
      symptomCounts.set(keyword, (symptomCounts.get(keyword) ?? 0) + 1);
    }
  }

  for (const [symptom, count] of symptomCounts) {
    if (count >= 2) {
      observations.push(`Recurrent ${symptom} symptoms reported`);
    }
  }

  if (hasDeteriorationSignal(allText)) {
    observations.push("Possible deterioration signals noted");
  }

  if (hasImprovementSignal(allText)) {
    observations.push("Improvement signals reported");
  }

  return observations;
}
