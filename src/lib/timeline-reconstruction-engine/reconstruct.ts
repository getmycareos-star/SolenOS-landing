import { TEMPORAL_SIGNAL_PATTERNS } from "./contract-constants";
import type { OrderingConflict, ReconstructedTimelineNode } from "./types";
import { parseEventTimeFromText } from "../time-model/parse-event-time";
import type { CanonicalCareEvent } from "../situation-entry/types";

const SEGMENT_SPLIT = /(?<=[.!?])\s+|;\s+/;

function splitSegments(text: string): string[] {
  return text
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sourceChannel(segment: string): ReconstructedTimelineNode["source_channel"] {
  if (TEMPORAL_SIGNAL_PATTERNS.correction.test(segment)) return "inferred_correction";
  if (TEMPORAL_SIGNAL_PATTERNS.relative.test(segment)) return "direct_observation";
  return "caregiver_recall";
}

function orderingLabel(confidence: number): ReconstructedTimelineNode["ordering_label"] {
  if (confidence >= 0.8) return "exact";
  if (confidence >= 0.5) return "approximate";
  return "conflict";
}

export function extractTemporalSegments(
  rawInput: string,
  ingestionTime: string,
): ReconstructedTimelineNode[] {
  const segments = splitSegments(rawInput);
  const nodes: ReconstructedTimelineNode[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const parsed = parseEventTimeFromText(segment, ingestionTime);
    const temporalConfidence = parsed.event_time.confidence ?? 0.5;
    const channel = sourceChannel(segment);

    let normalized = ingestionTime;
    if (parsed.event_time.type === "exact" && parsed.event_time.start) {
      normalized = parsed.event_time.start;
    } else if (parsed.event_time.type === "range" && parsed.event_time.start) {
      normalized = parsed.event_time.start;
    }

    nodes.push({
      node_id: `tl_node_${i}_${Date.now()}`,
      observation: segment.slice(0, 240),
      normalized_timestamp: normalized,
      temporal_confidence: temporalConfidence,
      ordering_confidence: TEMPORAL_SIGNAL_PATTERNS.correction.test(segment)
        ? Math.min(temporalConfidence + 0.1, 0.95)
        : temporalConfidence,
      ordering_label: orderingLabel(temporalConfidence),
      source_event_id: null,
      source_channel: channel,
      linked_temporal_nodes: [],
      event_type: inferEventType(segment),
    });
  }

  return nodes;
}

function inferEventType(text: string): string {
  if (/\b(medication|med|pill|dose|prescription)\b/i.test(text)) return "medication_change";
  if (/\b(hospital|discharge|er\b|emergency)\b/i.test(text)) return "care_transition";
  if (/\b(food|appetite|eating|refus\w*)\b/i.test(text)) return "symptom_reported";
  if (/\b(fell|fall|walker|mobility)\b/i.test(text)) return "mobility_change";
  return "observation";
}

export function reorderNodesChronologically(
  nodes: ReconstructedTimelineNode[],
): ReconstructedTimelineNode[] {
  const sorted = [...nodes].sort(
    (a, b) =>
      new Date(a.normalized_timestamp).getTime() - new Date(b.normalized_timestamp).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev) {
      sorted[i]!.linked_temporal_nodes = [prev.node_id];
    }
  }

  return sorted;
}

export function detectOrderingConflicts(
  nodes: ReconstructedTimelineNode[],
): OrderingConflict[] {
  const conflicts: OrderingConflict[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const timeA = new Date(a.normalized_timestamp).getTime();
      const timeB = new Date(b.normalized_timestamp).getTime();
      if (Math.abs(timeA - timeB) < 3600_000 && a.ordering_label === "conflict") {
        conflicts.push({
          conflict_id: `ord_${a.node_id}_${b.node_id}`,
          node_ids: [a.node_id, b.node_id],
          interpretations: [a.observation, b.observation],
          confidence: Math.min(a.temporal_confidence, b.temporal_confidence),
        });
      }
    }
  }

  return conflicts;
}

export function attachEventsToNodes(
  nodes: ReconstructedTimelineNode[],
  events: CanonicalCareEvent[],
): ReconstructedTimelineNode[] {
  return nodes.map((node, idx) => {
    const match = events[idx] ?? events.find((e) => node.observation.includes(e.raw_input.slice(0, 40)));
    return match ? { ...node, source_event_id: match.id } : node;
  });
}

export function buildClinicalClarificationTriggers(
  nodes: ReconstructedTimelineNode[],
  conflicts: OrderingConflict[],
): string[] {
  const triggers: string[] = [];
  if (conflicts.length > 0) {
    triggers.push("Did the earlier event occur before or after the hospital visit?");
  }
  const foodRefusal = nodes.find((n) => n.event_type === "symptom_reported");
  const hospital = nodes.find((n) => n.event_type === "care_transition");
  if (foodRefusal && hospital) {
    triggers.push("Did food refusal start before or after hospital discharge?");
  }
  return triggers.slice(0, 3);
}
