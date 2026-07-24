/**
 * Project Care Situation Understanding → caregiver orientation fields.
 * Never summary theater. Instant clarity over impressive prose.
 */

import type { CareSituationUnderstanding } from "./types";

export type CareSituationOrientationProjection = {
  recognition_line: string | null;
  what_is_happening: string;
  what_matters_now: string | null;
  what_can_wait: string | null;
  still_unclear: string[];
  what_we_know: string[];
  follow_up_items: string[];
  connection_note: string | null;
};

function personPhrase(person: string | null): string {
  if (!person) return "the person you care for";
  return person;
}

/**
 * Project understanding into Response Contract–aligned orientation.
 */
export function projectCareSituationOrientation(
  u: CareSituationUnderstanding,
): CareSituationOrientationProjection {
  const who = personPhrase(u.care_recipient);

  const factLines = u.facts
    .filter((f) => f.kind === "event" || f.kind === "observation" || f.kind === "decision")
    .map((f) => f.text)
    .slice(0, 5);

  const what_we_know = [
    ...factLines,
    ...u.interpretations.slice(0, 1).map((i) => `Held as uncertain: ${i.text}`),
  ].slice(0, 6);

  const what_is_happening =
    factLines.length >= 2
      ? `${who}: ${factLines.slice(0, 3).join(" · ")}`
      : factLines[0] ??
        (u.context_only[0]
          ? `Load and fragmented pieces are present — care details still need to be placed.`
          : `A care situation is being held for ${who}.`);

  const what_matters_now =
    u.matters_now.length > 0
      ? u.matters_now.slice(0, 2).join(" · ")
      : null;

  const what_can_wait =
    u.can_wait.length > 0
      ? u.can_wait.slice(0, 2).join(" · ")
      : u.context_only.length > 0
        ? "Organizing every paper or retelling everything at once."
        : null;

  const still_unclear = u.follow_up_questions.slice(0, 3);

  const recognition_line =
    u.facts.length >= 2
      ? `Several care changes are present at once for ${who} — held so priority is clearer than the mix in your head.`
      : u.context_only.length > 0 && u.facts.length === 0
        ? `The weight of holding everything is noted — share what is happening with ${who} when you can.`
        : null;

  const connection_note =
    u.possible_links[0]?.text ??
    (u.continuity_hooks.length > 1
      ? "These pieces stay connected for when something else changes."
      : null);

  const follow_up_items = [
    ...u.continuity_hooks.slice(0, 2).map((h) => `Keep connected: ${h.slice(0, 120)}`),
    ...(u.possible_links.length > 0
      ? ["Track whether changes and the recent care decision continue to move together."]
      : []),
  ].slice(0, 3);

  return {
    recognition_line,
    what_is_happening,
    what_matters_now,
    what_can_wait,
    still_unclear,
    what_we_know,
    follow_up_items,
    connection_note,
  };
}
