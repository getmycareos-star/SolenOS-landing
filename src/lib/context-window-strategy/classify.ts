import type { StressNormalizedOutput } from "../input-stress-normalizer";
import {
  ACTION_CRITICAL_PATTERN,
  EMOTIONAL_PATTERN,
  MEDICAL_FACTS_PATTERN,
  NEGATION_PATTERN,
  POSITIVE_STATE_PATTERN,
  TIME_SENSITIVE_PATTERN,
  UNCERTAINTY_PATTERN,
} from "./patterns";
import type { ContextPriorityBucket, StructuredContext } from "./types";

export const CONTEXT_BUCKET_ORDER: readonly ContextPriorityBucket[] = [
  "action_critical",
  "medical_facts",
  "time_sensitive_events",
  "contradictions",
  "emotional_context",
];

function segmentContent(segment: StressNormalizedOutput["segments"][number]): string | null {
  if (segment.type === "LINE_BREAK") return null;
  const content = segment.content.trim();
  return content.length > 0 ? content : null;
}

export function classifySegmentBucket(
  content: string,
  hasGlobalContradictions: boolean,
): ContextPriorityBucket {
  if (ACTION_CRITICAL_PATTERN.test(content)) return "action_critical";
  if (MEDICAL_FACTS_PATTERN.test(content)) return "medical_facts";
  if (TIME_SENSITIVE_PATTERN.test(content)) return "time_sensitive_events";
  if (UNCERTAINTY_PATTERN.test(content)) return "contradictions";
  if (
    hasGlobalContradictions &&
    (POSITIVE_STATE_PATTERN.test(content) || NEGATION_PATTERN.test(content))
  ) {
    return "contradictions";
  }
  if (EMOTIONAL_PATTERN.test(content)) return "emotional_context";
  return "emotional_context";
}

export function buildStructuredContext(
  stressOutput: StressNormalizedOutput,
): StructuredContext {
  const buckets: StructuredContext = {
    action_critical: [],
    medical_facts: [],
    time_sensitive_events: [],
    contradictions: [],
    emotional_context: [],
  };

  const hasGlobalContradictions = stressOutput.metadata.has_contradictions;

  for (const segment of stressOutput.segments) {
    const content = segmentContent(segment);
    if (!content) continue;

    const bucket = classifySegmentBucket(content, hasGlobalContradictions);
    buckets[bucket].push(content);
  }

  const assignedCount = CONTEXT_BUCKET_ORDER.reduce(
    (sum, key) => sum + buckets[key].length,
    0,
  );
  if (assignedCount === 0 && stressOutput.raw_input.length > 0) {
    buckets.emotional_context.push(stressOutput.raw_input);
  }

  return buckets;
}
