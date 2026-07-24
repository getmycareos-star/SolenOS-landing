import type { CareSnapshot, RawCareInput, SnapshotOptions } from "./types";
import { classifyEventType } from "./classify";
import {
  cleanText,
  extractDate,
  extractIdentity,
  splitIntoSentences,
} from "./normalize";
import { extractKeyObservations } from "./patterns";
import { synthesizeCareNotes } from "./synthesize-notes";

function sortTimeline<T extends { date: string | null; sourceIndex: number }>(
  events: T[],
): T[] {
  const dated = events
    .filter((e) => e.date !== null)
    .sort((a, b) => {
      const dateCompare = a.date!.localeCompare(b.date!);
      return dateCompare !== 0 ? dateCompare : a.sourceIndex - b.sourceIndex;
    });

  const undated = events
    .filter((e) => e.date === null)
    .sort((a, b) => a.sourceIndex - b.sourceIndex);

  return [...dated, ...undated];
}

export function buildSnapshot(
  inputs: RawCareInput[],
  options: SnapshotOptions = {},
): CareSnapshot {
  const referenceDate = options.referenceDate ?? new Date().toISOString();
  const identity = extractIdentity(inputs);
  const rawTexts = inputs.map((i) => i.text);

  const timeline = sortTimeline(
    inputs.flatMap((input, sourceIndex) => {
      const sentences = splitIntoSentences(input.text);
      return sentences.map((sentence) => {
        const { date, dateLabel } = extractDate(
          sentence,
          input.recordedAt ?? referenceDate,
        );
        return {
          date,
          dateLabel,
          description: cleanText(sentence),
          type: classifyEventType(sentence),
          sourceIndex,
        };
      });
    }),
  );

  const keyObservations = extractKeyObservations(timeline, rawTexts);
  const careNotes = synthesizeCareNotes(timeline, rawTexts);

  const snapshot: CareSnapshot = {
    timeline,
    keyObservations,
    careNotes,
    generatedAt: new Date().toISOString(),
  };

  if (identity.patientName || identity.contextLabel) {
    snapshot.identity = identity;
  }

  return snapshot;
}
