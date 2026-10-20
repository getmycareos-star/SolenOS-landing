import type { StressNormalizedOutput } from "../input-stress-normalizer";
import { buildStructuredContext, CONTEXT_BUCKET_ORDER } from "./classify";
import {
  CONTEXT_WINDOW_MAX_CHARS,
  ContextWindowOutputSchema,
  type ContextWindowOutput,
  type StructuredContext,
} from "./types";

const CRITICAL_BUCKETS = [
  "action_critical",
  "medical_facts",
  "time_sensitive_events",
  "contradictions",
] as const;

/** Remove consecutive duplicate words only — no semantic rewriting. */
function compressWordRepetition(text: string): string {
  return text.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
}

/** Remove exact duplicate lines within emotional context only. */
function dedupeEmotionalLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (key.length === 0) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function compressEmotionalLines(lines: string[]): string[] {
  return dedupeEmotionalLines(lines.map((line) => compressWordRepetition(line)));
}

function joinStructuredContext(context: StructuredContext): string {
  return CONTEXT_BUCKET_ORDER.map((bucket) => context[bucket].join("\n"))
    .filter((block) => block.length > 0)
    .join("\n\n");
}

function trimEmotionalTail(context: StructuredContext, maxChars: number): StructuredContext {
  const next: StructuredContext = {
    action_critical: [...context.action_critical],
    medical_facts: [...context.medical_facts],
    time_sensitive_events: [...context.time_sensitive_events],
    contradictions: [...context.contradictions],
    emotional_context: [...context.emotional_context],
  };

  while (next.emotional_context.length > 0 && joinStructuredContext(next).length > maxChars) {
    next.emotional_context.pop();
  }

  return next;
}

function countCriticalSegments(context: StructuredContext): number {
  return CRITICAL_BUCKETS.reduce((sum, bucket) => sum + context[bucket].length, 0);
}

/**
 * Deterministic lossless preservation under token constraints.
 * Compresses repetition and emotional verbosity only — never critical buckets.
 */
export function applyContextWindowStrategy(
  stressOutput: StressNormalizedOutput,
): ContextWindowOutput {
  const structured = buildStructuredContext(stressOutput);
  let compression_applied = false;

  const compressedEmotional = compressEmotionalLines(structured.emotional_context);
  if (
    compressedEmotional.length !== structured.emotional_context.length ||
    compressedEmotional.some((line, i) => line !== structured.emotional_context[i])
  ) {
    compression_applied = true;
  }

  let context: StructuredContext = {
    ...structured,
    emotional_context: compressedEmotional,
  };

  let preserved_text = joinStructuredContext(context);
  if (preserved_text.length > CONTEXT_WINDOW_MAX_CHARS) {
    compression_applied = true;
    context = trimEmotionalTail(context, CONTEXT_WINDOW_MAX_CHARS);
    preserved_text = joinStructuredContext(context);
  }

  if (preserved_text.length === 0 && stressOutput.raw_input.length > 0) {
    preserved_text = stressOutput.raw_input;
  }

  const output: ContextWindowOutput = {
    preserved_text,
    structured_context: context,
    compression_applied,
    source_tags: [...stressOutput.detected_tags],
    metadata: {
      critical_segments_preserved: countCriticalSegments(context),
      original_length: stressOutput.raw_input.length,
      preserved_length: preserved_text.length,
    },
  };

  return ContextWindowOutputSchema.parse(output);
}

export function verifyCriticalPreservation(output: ContextWindowOutput): boolean {
  for (const bucket of CRITICAL_BUCKETS) {
    for (const item of output.structured_context[bucket]) {
      if (!output.preserved_text.includes(item)) {
        return false;
      }
    }
  }
  return true;
}

export function verifyContradictionsIntact(
  output: ContextWindowOutput,
  stressOutput: StressNormalizedOutput,
): boolean {
  if (!stressOutput.metadata.has_contradictions) return true;

  const contradictionItems = output.structured_context.contradictions;
  if (contradictionItems.length < 2) {
    const hasPositive = stressOutput.segments.some(
      (s) => s.content && /\b(fine|okay|ok|good|well|stable|better|improving)\b/i.test(s.content),
    );
    const hasNegative = stressOutput.segments.some(
      (s) => s.content && /\b(not|n't|unresponsive|not responding)\b/i.test(s.content),
    );
    if (hasPositive && hasNegative) {
      return (
        output.preserved_text.includes(
          stressOutput.segments.find((s) =>
            /\b(fine|okay|ok|good|well|stable|better|improving)\b/i.test(s.content),
          )?.content ?? "",
        ) &&
        output.preserved_text.includes(
          stressOutput.segments.find((s) =>
            /\b(not|n't|unresponsive|not responding)\b/i.test(s.content),
          )?.content ?? "",
        )
      );
    }
  }

  return contradictionItems.length >= 1;
}
