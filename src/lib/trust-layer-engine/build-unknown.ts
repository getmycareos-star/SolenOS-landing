import type { ClarificationEngineResult } from "../clarification-engine/types";
import type { ContinuityDecayResult } from "../continuity-decay-engine/types";
import type { TrustUnknownItem } from "./types";

export function buildUnknownGaps(input: {
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  continuity_decay: ContinuityDecayResult;
  clarification: ClarificationEngineResult | undefined;
}): TrustUnknownItem[] {
  const unknown: TrustUnknownItem[] = [];
  const seen = new Set<string>();

  const add = (statement: string, drives_clarification: boolean) => {
    const key = statement.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    unknown.push({ statement, drives_clarification });
  };

  for (const q of input.what_needs_clarification.slice(0, 5)) {
    add(q, true);
  }

  for (const u of input.what_is_uncertain.slice(0, 5)) {
    add(u, true);
  }

  for (const gap of input.continuity_decay.continuity_gaps.slice(0, 3)) {
    add(`${gap.label} — ${gap.reason}`, true);
  }

  for (const stale of input.continuity_decay.stale_items.slice(0, 3)) {
    add(`Freshness uncertain: ${stale.label} (${stale.confidence_pct}% confidence)`, false);
  }

  for (const q of input.clarification?.questions.map((x) => x.question) ?? []) {
    add(q, true);
  }

  for (const dim of input.clarification?.missing_dimensions ?? []) {
    add(`Missing dimension: ${dim.replace(/_/g, " ")}`, true);
  }

  if (unknown.length === 0) {
    add("No explicit gaps flagged — add updates as the situation evolves", false);
  }

  return unknown.slice(0, 10);
}
