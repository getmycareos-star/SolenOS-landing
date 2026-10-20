import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MemoryStrategyResult } from "../memory-strategy-engine/types";
import type { TrustProvenanceResult } from "../trust-provenance/types";
import type { ContinuityDecayResult } from "../continuity-decay-engine/types";
import { FRESHNESS_BANDS } from "./contract-constants";
import type { TrustRecency } from "./types";

function daysSince(iso: string, asOf: string): number {
  const ms = new Date(asOf).getTime() - new Date(iso).getTime();
  return Math.max(0, ms / (24 * 60 * 60 * 1000));
}

export function computeRecency(
  events: CanonicalCareEvent[],
  continuity_decay: ContinuityDecayResult,
  asOf: string,
): TrustRecency {
  const sorted = [...events]
    .filter((e) => e.status !== "invalidated" && e.status !== "superseded")
    .sort((a, b) => new Date(b.ingestion_time).getTime() - new Date(a.ingestion_time).getTime());

  const last_updated_at = sorted[0]?.ingestion_time ?? null;
  const days = last_updated_at ? daysSince(last_updated_at, asOf) : 14;

  let freshness_score =
    continuity_decay.continuity_confidence_pct > 0
      ? continuity_decay.continuity_confidence_pct / 100
      : days <= 1
        ? 1
        : days <= 7
          ? 0.6
          : days <= 14
            ? 0.35
            : 0.15;

  freshness_score = Math.max(0, Math.min(1, Math.round(freshness_score * 100) / 100));

  let interpretation: string = FRESHNESS_BANDS.stale.label;
  if (freshness_score >= FRESHNESS_BANDS.fresh.min) {
    interpretation = FRESHNESS_BANDS.fresh.label;
  } else if (freshness_score >= FRESHNESS_BANDS.moderate.min) {
    interpretation = FRESHNESS_BANDS.moderate.label;
  }

  return { last_updated_at, freshness_score, interpretation };
}

export function computeConfidence(input: {
  trust_provenance: TrustProvenanceResult;
  continuity_decay: ContinuityDecayResult;
  memory_strategy: MemoryStrategyResult | undefined;
  unknown_count: number;
  assumed_count: number;
  freshness_score: number;
  has_verified_events: boolean;
}): number {
  const level = input.trust_provenance.confidence_assessment.level;
  let base = level === "high" ? 0.72 : level === "medium" ? 0.55 : 0.38;

  base *= 0.5 + input.freshness_score * 0.5;

  const contradictions = input.memory_strategy?.conflicts.length ?? 0;
  base -= contradictions * 0.08;
  base -= Math.min(input.unknown_count, 6) * 0.04;

  if (!input.has_verified_events) {
    base -= 0.12;
  }

  if (input.continuity_decay.continuity_confidence_pct < 50) {
    base -= 0.1;
  }

  if (input.assumed_count > 0 && input.unknown_count > 2) {
    base -= 0.05;
  }

  const capped = Math.max(0.08, Math.min(0.92, base));
  const fullyVerified =
    input.has_verified_events &&
    input.unknown_count === 0 &&
    contradictions === 0 &&
    input.freshness_score >= 0.95 &&
    level === "high";

  return fullyVerified ? 0.95 : Math.round(capped * 100) / 100;
}
