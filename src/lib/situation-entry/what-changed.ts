import type { CanonicalCareEvent, CareContextRoot } from "./types";

export function computeWhatChanged(
  priorContext: CareContextRoot | null,
  newEvents: CanonicalCareEvent[],
): string[] {
  const changes: string[] = [];

  if (!priorContext || priorContext.events.length === 0) {
    if (newEvents.length > 0) {
      changes.push("CareContextRoot created with first situation event.");
      changes.push(`New event added: ${newEvents[0]!.extracted_type.replace(/_/g, " ")}.`);
    }
    return changes;
  }

  const priorIds = new Set(priorContext.events.map((e) => e.id));
  const priorUncertainties = new Set(priorContext.events.flatMap((e) => e.uncertainty));

  for (const event of newEvents) {
    if (!priorIds.has(event.id)) {
      changes.push(
        `New event added (${event.extracted_type.replace(/_/g, " ")}): ${event.raw_input.slice(0, 80)}${event.raw_input.length > 80 ? "…" : ""}`,
      );
    }
  }

  const newUncertainties = newEvents.flatMap((e) => e.uncertainty).filter((u) => !priorUncertainties.has(u));
  for (const u of [...new Set(newUncertainties)].slice(0, 3)) {
    changes.push(`New uncertainty introduced: ${u}`);
  }

  const newFollowUps = newEvents.filter((e) => e.extracted_type === "follow_up");
  for (const f of newFollowUps) {
    changes.push(`New follow-up created from input: ${f.raw_input.slice(0, 60)}…`);
  }

  if (changes.length === 0 && newEvents.length > 0) {
    changes.push("Previous context updated with additional structured detail.");
  }

  return changes.slice(0, 6);
}
