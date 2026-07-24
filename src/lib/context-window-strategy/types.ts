import { z } from "zod";

export const CONTEXT_PRIORITY_BUCKETS = [
  "action_critical",
  "medical_facts",
  "time_sensitive_events",
  "contradictions",
  "emotional_context",
] as const;

export type ContextPriorityBucket = (typeof CONTEXT_PRIORITY_BUCKETS)[number];

export const StructuredContextSchema = z
  .object({
    action_critical: z.array(z.string()),
    medical_facts: z.array(z.string()),
    time_sensitive_events: z.array(z.string()),
    contradictions: z.array(z.string()),
    emotional_context: z.array(z.string()),
  })
  .strict();

export type StructuredContext = z.infer<typeof StructuredContextSchema>;

export const ContextWindowMetadataSchema = z
  .object({
    critical_segments_preserved: z.number().int().min(0),
    original_length: z.number().int().min(0),
    preserved_length: z.number().int().min(0),
  })
  .strict();

export const ContextWindowOutputSchema = z
  .object({
    preserved_text: z.string(),
    structured_context: StructuredContextSchema,
    compression_applied: z.boolean(),
    source_tags: z.array(z.string()),
    metadata: ContextWindowMetadataSchema,
  })
  .strict();

export type ContextWindowOutput = z.infer<typeof ContextWindowOutputSchema>;

/** MVP character budget before emotional-only compression applies. */
export const CONTEXT_WINDOW_MAX_CHARS = 6000;
