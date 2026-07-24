import { z } from "zod";

export const STRESS_NORMALIZER_TAGS = [
  "LONG_UNSTRUCTURED_TEXT",
  "EMOTIONAL_OVERLOAD",
  "MEDICAL_FRAGMENT",
  "CONTRADICTORY_STATEMENTS",
  "INCOMPLETE_CONTEXT",
  "MIXED_INPUT",
] as const;

export type StressNormalizerTag = (typeof STRESS_NORMALIZER_TAGS)[number];

export const StressNormalizedSegmentSchema = z.object({
  type: z.string(),
  content: z.string(),
});

export const StressNormalizedMetadataSchema = z.object({
  has_emotional_language: z.boolean(),
  has_medical_content: z.boolean(),
  has_contradictions: z.boolean(),
  has_incomplete_context: z.boolean(),
});

export const StressNormalizedOutputSchema = z
  .object({
    raw_input: z.string(),
    detected_tags: z.array(z.string()),
    segments: z.array(StressNormalizedSegmentSchema),
    metadata: StressNormalizedMetadataSchema,
  })
  .strict();

export type StressNormalizedOutput = z.infer<typeof StressNormalizedOutputSchema>;

export type StressNormalizedSegment = z.infer<typeof StressNormalizedSegmentSchema>;
