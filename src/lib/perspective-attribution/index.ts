/**
 * Perspective attribution (G16) — who-said on shared Living Care Record.
 *
 * Not a caregiver chat feed. Surfaces distinct held views with optional
 * role labels when contributor ids encode family roles.
 * Private raw cross-user leak remains forbidden (multi-caregiver privacy).
 */

import type { ActiveCareSituation, SituationObservation } from "../active-care-situation/types";
import { observationCareFact } from "../care-epistemics";

export const PERSPECTIVE_ATTRIBUTION_PURPOSE =
  "Organize disagreeing views with visible attribution — never silent winner, never chat feed.";

function roleLabel(contributorId: string | null | undefined): string | null {
  if (!contributorId) return null;
  const id = contributorId.toLowerCase();
  if (/\bdaughter\b/.test(id)) return "Daughter";
  if (/\bson\b/.test(id)) return "Son";
  if (/\bbrother\b/.test(id)) return "Brother";
  if (/\bsister\b/.test(id)) return "Sister";
  if (/\bspouse|wife|husband\b/.test(id)) return "Spouse";
  if (/\bnurse|aide|professional\b/.test(id)) return "Care professional";
  return null;
}

function shortFact(o: SituationObservation, priorFacts: readonly string[]): string {
  const fact =
    observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
      priorFacts,
    }) ?? (o.human_fact || o.raw_text).trim();
  return fact.slice(0, 100);
}

/**
 * Build caregiver-visible perspective lines when multiple contributors differ.
 * Both sides retained — never silent winner (Slice 5.4).
 */
export function composePerspectiveAttribution(params: {
  situation: ActiveCareSituation;
  patternLabel?: string | null;
}): {
  show: boolean;
  evidence_line: string | null;
  what_we_know_extra: string[];
  silent_winner: false;
  both_retained: true;
} {
  const obs = params.situation.observations;
  const withIds = obs.filter((o) => o.contributor_id);
  const ids = [...new Set(withIds.map((o) => o.contributor_id!))];
  const conflictPattern =
    params.patternLabel === "disagreeing care views" ||
    params.patternLabel === "source conflict";

  if (ids.length < 2 && !conflictPattern) {
    return {
      show: false,
      evidence_line: null,
      what_we_know_extra: [],
      silent_winner: false,
      both_retained: true,
    };
  }

  // Pick latest observation per contributor (sequential priorFacts for thin threads)
  const latestByContributor = new Map<string, SituationObservation>();
  const priorFacts: string[] = [];
  for (const o of obs) {
    const id = o.contributor_id ?? "unknown";
    latestByContributor.set(id, o);
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
      priorFacts,
    });
    if (fact) priorFacts.push(fact);
  }

  if (latestByContributor.size < 2 && !conflictPattern) {
    return {
      show: false,
      evidence_line: null,
      what_we_know_extra: [],
      silent_winner: false,
      both_retained: true,
    };
  }

  const extras: string[] = [];
  const factPriors: string[] = [];
  for (const [id, o] of latestByContributor) {
    const role = roleLabel(id);
    const fact = shortFact(o, factPriors);
    if (!fact) continue;
    factPriors.push(fact);
    extras.push(role ? `${role}: ${fact}` : fact);
  }

  const capped = extras.slice(0, 3);
  if (capped.length < 2 && !conflictPattern) {
    return {
      show: false,
      evidence_line: null,
      what_we_know_extra: [],
      silent_winner: false,
      both_retained: true,
    };
  }

  return {
    show: capped.length >= 2 || conflictPattern,
    evidence_line:
      capped.length >= 2
        ? `Different views held: ${capped.join(" · ")} — both kept.`
        : "More than one view is held — nothing was erased.",
    what_we_know_extra: capped,
    silent_winner: false,
    both_retained: true,
  };
}
