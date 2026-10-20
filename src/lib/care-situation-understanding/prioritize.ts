/**
 * Deterministic prioritization from Care Reality objects.
 * Impact order — never word-count, emotion volume, or task appearance.
 */

import type {
  CareSituationFact,
  CareSituationUnderstanding,
} from "./types";
import { attentionRankForExtractionCategory } from "../care-reality-intelligence/no-hardcode-contract";
import { looksLikeContributorLoadFragment } from "../care-reality-extraction/classify";

/** Structural: scattered sources / retelling — can wait relative to safety/change. */
export function looksLikeFragmentationOrAdmin(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /\b(?:medication list|hospital papers?|papers from|messages from|somewhere|explain everything|mixed together)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(?:brother|sister|family)\b/i.test(t) &&
    /\b(?:asked|explain|tell|noticed)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

function factAttention(f: CareSituationFact): number {
  return attentionRankForExtractionCategory(f.kind);
}

/**
 * Rank facts into matters_now vs can_wait.
 * Events/observations of recipient state outrank admin/fragmentation/load.
 */
export function prioritizeCareSituation(params: {
  facts: CareSituationFact[];
  unknowns: string[];
  context_only: string[];
  possible_links: CareSituationUnderstanding["possible_links"];
  changes_from_baseline: string[];
}): Pick<
  CareSituationUnderstanding,
  "matters_now" | "can_wait" | "follow_up_questions" | "continuity_hooks"
> {
  const matters: string[] = [];
  const wait: string[] = [];

  const sorted = [...params.facts].sort(
    (a, b) => factAttention(a) - factAttention(b),
  );

  for (const f of sorted) {
    if (looksLikeFragmentationOrAdmin(f.text) || looksLikeContributorLoadFragment(f.text)) {
      wait.push(f.text);
      continue;
    }
    if (f.kind === "event" || f.kind === "observation") {
      matters.push(f.text);
      continue;
    }
    if (f.kind === "decision") {
      // Care decisions matter for connection — keep high but after safety/state
      matters.push(f.text);
      continue;
    }
    wait.push(f.text);
  }

  // Changes and possible links elevate orientation
  for (const c of params.changes_from_baseline.slice(0, 2)) {
    if (!matters.some((m) => m.toLowerCase().includes(c.toLowerCase().slice(0, 24)))) {
      matters.unshift(c);
    }
  }

  for (const link of params.possible_links.slice(0, 1)) {
    if (!matters.includes(link.text)) {
      // Link is orientation about uncertainty — belongs near matters, not as advice
      matters.push(link.text);
    }
  }

  for (const ctx of params.context_only.slice(0, 2)) {
    if (!wait.includes(ctx)) wait.push(ctx);
  }

  // Deduplicate preserving order
  const dedupe = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => {
      const k = x.toLowerCase().slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const matters_now = dedupe(matters).slice(0, 4);
  const can_wait = dedupe(wait).slice(0, 4);

  // Questions only from unknowns — max 3
  const follow_up_questions = dedupe(params.unknowns)
    .filter((q) => q.trim().length >= 12)
    .slice(0, 3)
    .map((q) => (/\?$/.test(q.trim()) ? q.trim() : `${q.trim().replace(/\.$/, "")}?`));

  const continuity_hooks = dedupe([
    ...matters_now.slice(0, 3),
    ...params.possible_links.map((l) => l.text).slice(0, 1),
    ...follow_up_questions.slice(0, 2),
  ]).slice(0, 6);

  return { matters_now, can_wait, follow_up_questions, continuity_hooks };
}
