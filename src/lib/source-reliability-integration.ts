/**
 * Source Reliability Integration — applies reliability weights to event confidence.
 * Reliability = input truth quality. Independent from system confidence.
 */

import type { CanonicalCareEvent } from "./situation-entry/types";
import type { SourceReliability } from "./continuity-properties/source-reliability";
import { classifySourceReliability } from "./continuity-properties/source-reliability";
import type { EvidenceObject } from "./evidence-preservation";

export type SourceReliabilityAnnotatedEvent = CanonicalCareEvent & {
  reliability_annotation: SourceReliability;
};

export type SourceTransparencySummary = {
  by_source: Record<
    string,
    { count: number; avg_reliability: number; examples: string[] }
  >;
  overall_reliability: number;
  low_reliability_count: number;
  total_events: number;
};

/**
 * Attach reliability annotation to each event.
 */
export function applySourceReliabilityToEvents(
  events: CanonicalCareEvent[],
): SourceReliabilityAnnotatedEvent[] {
  return events.map((e) => ({
    ...e,
    reliability_annotation: e.source_reliability
      ? {
          source_type: e.source_reliability.source_type,
          reliability_score: e.source_reliability.reliability_score,
          rationale: e.source_reliability.rationale,
        }
      : classifySourceReliability({
          source: e.source,
          raw_input: e.raw_input,
          attribution_source_type: e.source_attribution?.source_type,
        }),
  }));
}

/**
 * Compute weighted confidence using Bayesian-style update.
 * Higher reliability increases confidence; lower decreases it.
 * Weighted = baseConfidence * (avgReliability / 0.8), clamped to [0.1, 0.95]
 */
export function computeWeightedConfidence(
  events: CanonicalCareEvent[],
  baseConfidence: number,
): number {
  if (events.length === 0) return Math.max(0.1, Math.min(0.95, baseConfidence));

  const annotated = applySourceReliabilityToEvents(events);
  const avgReliability =
    annotated.reduce((s, e) => s + e.reliability_annotation.reliability_score, 0) /
    annotated.length;

  const weighted = baseConfidence * (avgReliability / 0.8);
  return Math.max(0.1, Math.min(0.95, weighted));
}

/**
 * Filter out events below reliability threshold. Default 0.5.
 * Never deletes — only excludes from reasoning.
 */
export function filterLowReliabilityEvents(
  events: CanonicalCareEvent[],
  threshold: number = 0.5,
): CanonicalCareEvent[] {
  return events.filter((e) => {
    const rel = e.source_reliability?.reliability_score ?? classifySourceReliability({
      source: e.source,
      raw_input: e.raw_input,
      attribution_source_type: e.source_attribution?.source_type,
    }).reliability_score;
    return rel >= threshold;
  });
}

/**
 * Build source transparency summary for caregiver-facing output.
 */
export function buildSourceTransparencySummary(
  events: CanonicalCareEvent[],
): SourceTransparencySummary {
  const annotated = applySourceReliabilityToEvents(events);
  const bySource: Record<string, { count: number; avg_reliability: number; examples: string[] }> = {};

  for (const e of annotated) {
    const key = e.reliability_annotation.source_type;
    if (!bySource[key]) {
      bySource[key] = { count: 0, avg_reliability: 0, examples: [] };
    }
    bySource[key].count += 1;
    bySource[key].avg_reliability += e.reliability_annotation.reliability_score;
    if (bySource[key].examples.length < 3) {
      bySource[key].examples.push(e.raw_input.slice(0, 80));
    }
  }

  for (const key of Object.keys(bySource)) {
    bySource[key].avg_reliability = bySource[key].avg_reliability / bySource[key].count;
  }

  const totalReliability = annotated.reduce((s, e) => s + e.reliability_annotation.reliability_score, 0);
  const lowCount = annotated.filter((e) => e.reliability_annotation.reliability_score < 0.5).length;

  return {
    by_source: bySource,
    overall_reliability: annotated.length > 0 ? totalReliability / annotated.length : 0.5,
    low_reliability_count: lowCount,
    total_events: annotated.length,
  };
}

/**
 * Apply reliability weights to an evidence object.
 */
export function applyReliabilityToEvidenceObject(
  evidence: EvidenceObject,
  events: CanonicalCareEvent[],
): EvidenceObject {
  if (events.length === 0) return evidence;

  const annotated = applySourceReliabilityToEvents(events);
  const avgReliability =
    annotated.reduce((s, e) => s + e.reliability_annotation.reliability_score, 0) /
    annotated.length;

  const relevantEvents = annotated.filter((e) =>
    evidence.event_ids.includes(e.id),
  );
  const relevantReliability =
    relevantEvents.length > 0
      ? relevantEvents.reduce((s, e) => s + e.reliability_annotation.reliability_score, 0) /
        relevantEvents.length
      : avgReliability;

  return {
    ...evidence,
    source_reliability_score: Math.max(0.1, Math.min(0.95, relevantReliability)),
  };
}