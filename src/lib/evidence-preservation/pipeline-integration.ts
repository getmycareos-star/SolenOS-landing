/**
 * Evidence Preservation Pipeline Integration
 * Integrates buildEvidenceObject() into reasoning stage and connects
 * contradiction-detection output → evidence chain for transparency.
 */

import type {
  EvidenceObject,
  EvidencedConclusion,
  EvidenceContext,
} from "./index";
import {
  buildEvidenceObject,
  buildEvidencedConclusion,
} from "./index";
import { buildTransparencyAuditTrail, type EvidenceTraceContext } from "./evidence-builder";
import type {
  PriorityState,
  ActionState,
} from "../engine/domain/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContradictionDetectionResult } from "../contradiction-detection-engine";
import type { ContinuityPropertiesResult } from "../continuity-properties";
import type { BaselineIntelligenceResult } from "../baseline-intelligence-engine";
import type { SourceReliability } from "../continuity-properties/source-reliability";

export interface EvidencePipelineInput {
  care_recipient_id: string;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  what_changed: string[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  baseline_comparison?: BaselineIntelligenceResult;
  contradiction_detection?: ContradictionDetectionResult;
  continuity_properties?: ContinuityPropertiesResult;
  care_state_confidence: number;
  explicit_unknowns?: Array<{ missing_information: string; priority: string; reason_it_matters: string }>;
  reasoning_summary: string;
  as_of: string;
}

export interface EvidencePipelineOutput {
  evidence_objects: EvidenceObject[];
  evidenced_conclusions: EvidencedConclusion[];
  transparency_audit: ReturnType<typeof buildTransparencyAuditTrail>;
  aggregated_confidence: {
    overall: number;
    by_area: Record<string, number>;
    label: "high" | "moderate" | "limited" | "low";
  };
}

/**
 * Build event timeline labels from canonical care events
 */
function buildTimelineLabels(events: CanonicalCareEvent[], max: number = 5): string[] {
  return events
    .slice(-max)
    .map((e) => {
      const date = new Date(e.event_time?.start ?? e.timestamp).toLocaleDateString();
      const type = e.extracted_type.replace(/_/g, " ");
      return `${date}: ${type} — ${e.raw_input.slice(0, 80)}`;
    });
}

/**
 * Determine observation type from event source
 */
function determineObservationType(event: CanonicalCareEvent): "direct" | "inferred" | "mixed" {
  if (event.source === "user_input") {
    return "direct";
  }
  if (event.source === "document") {
    return "direct";
  }
  return "mixed";
}

/**
 * Compute source reliability score from event
 */
function computeSourceReliability(event: CanonicalCareEvent): number {
  if (event.source_reliability) {
    return event.source_reliability.reliability_score;
  }
  // Fallback based on source
  if (event.source === "document") return 0.85;
  if (event.source === "user_input") return 0.9;
  return 0.5;
}

/**
 * Extract contradiction links from contradiction detection result
 */
function extractContradictionLinks(contradictionResult?: ContradictionDetectionResult): string[] {
  if (!contradictionResult) return [];
  return contradictionResult.open_contradictions.flatMap((c) => c.event_ids);
}

/**
 * Build evidence context from pipeline input
 */
function buildEvidenceContextFromPipeline(input: EvidencePipelineInput): EvidenceContext {
  const primaryEvents = input.events_created.length > 0
    ? input.events_created
    : input.all_events.slice(-3);

  const eventIds = primaryEvents.map((e) => e.id);
  const timelineLabels = buildTimelineLabels(primaryEvents);
  const observationTypes = primaryEvents.map(determineObservationType);
  const sourceReliabilities = primaryEvents.map(computeSourceReliability);

  const avgReliability = sourceReliabilities.length > 0
    ? sourceReliabilities.reduce((a, b) => a + b, 0) / sourceReliabilities.length
    : 0.5;

  const contradictionLinks = extractContradictionLinks(input.contradiction_detection);

  return {
    event_ids: eventIds,
    timeline_references: timelineLabels,
    confidence_score: Math.min(1, 0.6 + (input.events_created.length * 0.1)),
    source_reliability_score: avgReliability,
    contradiction_links: contradictionLinks,
    reasoning_summary: input.reasoning_summary,
    what_would_increase_confidence: [
      ...(input.explicit_unknowns?.slice(0, 2).map((u) => u.missing_information) ?? []),
      "Confirm with clinical documentation",
      "Obtain additional caregiver observation",
    ],
  };
}

/**
 * Build evidenced conclusions for key response sections
 */
function buildEvidencedConclusions(
  input: EvidencePipelineInput,
  evidenceContexts: EvidenceContext[],
): EvidencedConclusion[] {
  const conclusions: EvidencedConclusion[] = [];

  if (input.what_changed.length > 0) {
    conclusions.push(buildEvidencedConclusion({
      recommendation: `What changed: ${input.what_changed.slice(0, 3).join("; ")}`,
      implied_action: "Monitor for continuation or escalation",
      evidence: buildEvidenceObject({
        event_ids: evidenceContexts[0]?.event_ids ?? [],
        timeline_labels: evidenceContexts[0]?.timeline_references ?? [],
        confidence_score: evidenceContexts[0]?.confidence_score ?? 0.6,
        source_reliability_score: evidenceContexts[0]?.source_reliability_score ?? 0.7,
        contradiction_links: evidenceContexts[0]?.contradiction_links ?? [],
        reasoning_summary: `Detected changes from ${input.events_created.length} new event(s) and ${input.all_events.length} total events`,
        what_would_increase_confidence: [
          "Clinical confirmation of reported changes",
          "Additional caregiver observations over time",
        ],
      }),
    }));
  }

  for (const uncertainty of input.what_is_uncertain.slice(0, 2)) {
    conclusions.push(buildEvidencedConclusion({
      recommendation: `Uncertain: ${uncertainty}`,
      implied_action: "Request clarification from caregiver or care team",
      evidence: buildEvidenceObject({
        event_ids: [],
        timeline_labels: [],
        confidence_score: 0.3,
        source_reliability_score: 0.5,
        reasoning_summary: `Explicit unknown identified: ${uncertainty}`,
        what_would_increase_confidence: [
          "Direct caregiver clarification",
          "Documented clinical assessment",
        ],
      }),
    }));
  }

  return conclusions;
}

/**
 * Main pipeline integration function
 */
export function runEvidencePreservationPipeline(input: EvidencePipelineInput): EvidencePipelineOutput {
  const evidenceContext = buildEvidenceContextFromPipeline(input);
  const evidenceContexts = [evidenceContext];

  const evidenceObjects = evidenceContexts.map((ctx) =>
    buildEvidenceObject({
      event_ids: ctx.event_ids,
      timeline_labels: ctx.timeline_references,
      confidence_score: ctx.confidence_score,
      source_reliability_score: ctx.source_reliability_score,
      contradiction_links: ctx.contradiction_links,
      reasoning_summary: ctx.reasoning_summary,
      what_would_increase_confidence: ctx.what_would_increase_confidence,
    })
  );

  const evidencedConclusions = buildEvidencedConclusions(input, evidenceContexts);

  const transparencyAudit = buildTransparencyAuditTrail(
    evidenceContexts,
    { reasons: input.what_changed, confidence: "medium" } as unknown as PriorityState,
    { actions: { do_now: [], ask_professional: [] } } as unknown as ActionState,
  );

  const confidenceScores = evidenceObjects.map((e) => e.confidence_score);
  const overallConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
    : 0.5;

  const confLabel =
    overallConfidence >= 0.8 ? "high" :
    overallConfidence >= 0.55 ? "moderate" :
    overallConfidence >= 0.35 ? "limited" : "low";

  const byArea: Record<string, number> = {};
  if (input.baseline_comparison?.deviations) {
    for (const dev of input.baseline_comparison.deviations) {
      byArea[dev.domain] = dev.confidence === "high" ? 0.85 : dev.confidence === "medium" ? 0.65 : 0.45;
    }
  }

  return {
    evidence_objects: evidenceObjects,
    evidenced_conclusions: evidencedConclusions,
    transparency_audit: transparencyAudit,
    aggregated_confidence: {
      overall: overallConfidence,
      by_area: byArea,
      label: confLabel,
    },
  };
}

export function createEvidencePipelineInput(
  careRecipientId: string,
  pipelineData: {
    events_created: CanonicalCareEvent[];
    all_events: CanonicalCareEvent[];
    what_changed: string[];
    what_is_uncertain: string[];
    what_needs_clarification: string[];
    baseline_comparison?: BaselineIntelligenceResult;
    contradiction_detection?: ContradictionDetectionResult;
    continuity_properties?: ContinuityPropertiesResult;
    care_state_confidence: number;
    explicit_unknowns?: Array<{ missing_information: string; priority: string; reason_it_matters: string }>;
    reasoning_summary: string;
  },
  asOf: string,
): EvidencePipelineInput {
  return {
    care_recipient_id: careRecipientId,
    ...pipelineData,
    as_of: asOf,
  };
}