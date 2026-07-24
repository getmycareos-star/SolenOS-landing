import type { AlternativeOption, ChallengeComparison } from "./types";
import { stripSystemJargon } from "./emotional-readability";

function labelOf(option: AlternativeOption): string {
  return stripSystemJargon((option.label || option.id).replace(/[_-]+/g, " "));
}

/**
 * Challenge Mode (MVP) — structured "Why not X?" comparison.
 * Deterministic templates from chosen vs alternative labels only; no LLM.
 */
export function challengeModeCompare(
  chosen: AlternativeOption,
  alternative: AlternativeOption,
  sharedFacts: readonly string[] = [],
): ChallengeComparison {
  const chosenLabel = labelOf(chosen);
  const altLabel = labelOf(alternative);

  return {
    question: `Why not ${altLabel}?`,
    chosenId: chosen.id,
    chosenLabel,
    alternativeId: alternative.id,
    alternativeLabel: altLabel,
    whyChosenInstead: `"${chosenLabel}" ranked ahead of "${altLabel}" on the current decision graph (pressure, risk, timing, or missing-detail rules).`,
    whatAlternativeWouldTrade: `Choosing "${altLabel}" instead would defer "${chosenLabel}", which currently carries higher priority on that same ranking.`,
    sharedFacts: sharedFacts.map(stripSystemJargon).filter(Boolean).slice(0, 5),
  };
}
