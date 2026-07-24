import {
  CASE_DECISION_SNAPSHOT_KEYS,
  CASE_MEMORY_LAYER_FORBIDDEN,
} from "./contract-constants";
import {
  isExactDecisionSnapshotSchema,
  listsMultiplePastDates,
} from "./assemble-decision-snapshot";
import type { CaseMemoryGuaranteeResult, CaseMemoryLayerResult } from "./types";

export function runCaseMemoryGuarantee(
  layer: CaseMemoryLayerResult,
): CaseMemoryGuaranteeResult {
  const violations: string[] = [];

  if (!isExactDecisionSnapshotSchema(layer.snapshot)) {
    violations.push("decision_snapshot must have exact 6 keys only");
  } else {
    const keys = Object.keys(layer.snapshot);
    for (const k of CASE_DECISION_SNAPSHOT_KEYS) {
      if (!keys.includes(k)) violations.push(`missing snapshot key: ${k}`);
    }
    if (keys.length !== CASE_DECISION_SNAPSHOT_KEYS.length) {
      violations.push("extra keys on decision_snapshot");
    }
  }

  if (layer.policy.state === "A") {
    const histPhrases = [
      /\bpreviously\b/i,
      /\blast\s+time\b/i,
      /\bmirrors?\s+a\s+prior\b/i,
      /\bmatched\s+a\s+previously\b/i,
      /\bon\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    ];
    const blob = [
      layer.snapshot.what_is_happening,
      layer.snapshot.what_matters_now,
      layer.snapshot.what_to_ask_next,
      ...layer.snapshot.follow_up_items,
    ].join(" ");
    if (histPhrases.some((p) => p.test(blob))) {
      violations.push("State A must not reference history phrases");
    }
  }

  if (layer.policy.state === "C") {
    const followUp = layer.snapshot.follow_up_items.join(" ");
    if (listsMultiplePastDates(followUp)) {
      violations.push("State C follow_up must not list multiple past dates");
    }
    if (!/intervention|apply|technique|grounding|towel|redirect|replicate|monitor/i.test(followUp)) {
      violations.push("State C follow_up must emphasize action / intervention replication");
    }
    if (/what worked on \d{4}|see timeline events|full history/i.test(followUp)) {
      violations.push("State C must not narrate full history");
    }
  }

  if (layer.recall.ranked.length > 5) {
    violations.push("selective recall exceeded top 5");
  }

  // Forbidden identity check — soft (documentation constant presence)
  if (CASE_MEMORY_LAYER_FORBIDDEN.length < 3) {
    violations.push("case memory forbidden list too thin");
  }

  return { ok: violations.length === 0, violations };
}

export function validateCaseMemoryLayerResult(
  layer: CaseMemoryLayerResult,
): CaseMemoryGuaranteeResult {
  return layer.guarantee.ok
    ? layer.guarantee
    : runCaseMemoryGuarantee(layer);
}
