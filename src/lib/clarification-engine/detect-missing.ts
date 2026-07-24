import { MISSING_DIMENSIONS, VAGUE_INPUT_PATTERNS } from "./contract-constants";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MissingDimension } from "./types";

export function isVagueInput(rawInput: string): boolean {
  return VAGUE_INPUT_PATTERNS.some((p) => p.test(rawInput));
}

export function detectMissingDimensions(input: {
  raw_input: string;
  events_created: CanonicalCareEvent[];
  what_is_uncertain: string[];
}): MissingDimension[] {
  const missing = new Set<MissingDimension>();
  const text = input.raw_input.toLowerCase();
  const combinedUncertain = input.what_is_uncertain.join(" ").toLowerCase();

  if (
    isVagueInput(input.raw_input) ||
    combinedUncertain.includes("when") ||
    input.events_created.some((e) => e.uncertainty.some((u) => /when|time|date/i.test(u))) ||
    !/\b(today|yesterday|week|month|\d+\s+days?|when|since|morning|night)\b/i.test(text)
  ) {
    missing.add("timeline");
  }

  if (isVagueInput(input.raw_input) || /\b(confus|acting|behavior|mood)\b/i.test(text)) {
    missing.add("symptoms");
  }

  if (isVagueInput(input.raw_input) || !/\b(severe|worried|concern|safety|fall|hurt)\b/i.test(text)) {
    missing.add("severity");
  }

  if (!/\b(before|after|because|since|when|trigger)\b/i.test(text)) {
    missing.add("triggers");
  }

  if (!/\b(sudden|gradual|slowly|quickly|overnight|progress)\b/i.test(text)) {
    missing.add("progression");
  }

  if (!/\b(often|again|repeat|times|frequency)\b/i.test(text)) {
    missing.add("frequency");
  }

  if (/\b(fell|fall|wander|unsafe|alone)\b/i.test(text)) {
    missing.add("safety_impact");
  }

  if (/\b(med|pill|medication|dose)\b/i.test(text) || combinedUncertain.includes("medication")) {
    missing.add("medication_context");
  }

  if (!/\b(routine|caregiver|travel|hospital|discharge|environment)\b/i.test(text)) {
    missing.add("environment_context");
  }

  if (missing.size === 0 && input.what_is_uncertain.length > 0) {
    missing.add("timeline");
    missing.add("symptoms");
  }

  return [...missing].filter((d) => MISSING_DIMENSIONS.includes(d));
}

export function estimateUncertaintyLevel(missingCount: number, isVague: boolean): import("./types").UncertaintyLevel {
  if (missingCount === 0 && !isVague) return "low";
  if (isVague && missingCount >= 4) return "high";
  if (missingCount >= 5) return "high";
  if (missingCount >= 2) return "medium";
  return "low";
}
