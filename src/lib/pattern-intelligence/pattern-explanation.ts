import type { DetectedPattern } from "./types";
import { PROHIBITED_PATTERN_LANGUAGE } from "./contract-constants";

export function buildPatternSummary(patterns: DetectedPattern[]): string[] {
  return patterns.map((p) => `- ${p.description}`);
}

export function formatPatternExplanation(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) {
    return "No temporal patterns detected in the current care journey.";
  }

  const lines = ["Pattern Detected:", ...buildPatternSummary(patterns), ""];

  const discussionNotes = [...new Set(patterns.map((p) => p.discussion_note))];
  if (discussionNotes.length > 0) {
    lines.push(discussionNotes[0]!);
  }

  return lines.join("\n");
}

export function formatRiskPatternAlert(patterns: DetectedPattern[]): string | null {
  const significant = patterns.filter(
    (p) => p.confidence !== "low" || p.pattern_type === "co_occurrence",
  );
  if (significant.length < 2) return null;

  const labels = significant.slice(0, 5).map((p) => `- ${p.label}`);
  return [
    `Multiple changes detected over the past 30 days:`,
    ...labels,
    "",
    "This combination may be important to review at the next care appointment.",
  ].join("\n");
}

/** Enforce non-diagnostic language — strip prohibited terms if present. */
export function sanitizePatternText(text: string): string {
  let result = text;
  for (const term of PROHIBITED_PATTERN_LANGUAGE) {
    const re = new RegExp(term, "gi");
    result = result.replace(re, "[removed]");
  }
  return result;
}

export function lowConfidenceNote(patterns: DetectedPattern[]): string | null {
  const allLow = patterns.length > 0 && patterns.every((p) => p.confidence === "low");
  if (allLow) {
    return "Pattern confidence: low. More structured observations needed before reliable interpretation.";
  }
  if (patterns.some((p) => p.confidence === "low")) {
    return "Some patterns have low confidence — additional recorded observations would help.";
  }
  return null;
}
