/**
 * Zod schema for validating LLM Structured Understanding output.
 * Must validate against the same shape as CareRealityExtractionResult
 * to ensure downstream compatibility.
 */
import { z } from "zod";

export const LlmObservationSchema = z.object({
  description: z.string().min(1).max(500),
  approximate_time: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  raw_fragment: z.string().min(1),
});

export const LlmEventSchema = z.object({
  description: z.string().min(1).max(500),
  time: z.string().nullable(),
  participants: z.array(z.string()).max(10),
  raw_fragment: z.string().min(1),
});

export const LlmDecisionSchema = z.object({
  description: z.string().min(1).max(500),
  who: z.array(z.string()).max(10),
  why: z.string().nullable(),
  reason_unknown: z.boolean(),
  status: z.enum(["active", "completed", "changed", "reversed", "uncertain", "needs_review", "pending"]),
  raw_fragment: z.string().min(1),
});

export const LlmOutcomeSchema = z.object({
  description: z.string().min(1).max(500),
  status: z.enum(["observed", "pending", "uncertain", "ongoing", "resolved", "changed"]),
  raw_fragment: z.string().min(1),
});

export const LlmUnknownSchema = z.object({
  question: z.string().min(1).max(500),
  status: z.enum(["open", "answered", "declined", "no_longer_relevant"]),
  raw_fragment: z.string().min(1),
});

export const LlmNonCareFactSchema = z.object({
  layer: z.enum(["contributor_load", "disagreement_perspective"]),
  text: z.string().min(1).max(500),
  raw_fragment: z.string().min(1),
});

export const LlmPossibleLinkSchema = z.object({
  text: z.string().min(1).max(500),
  causation_claimed: z.literal(false, {
    message: "causation_claimed must always be false — never assert causation",
  }),
});

export const LlmUnderstandingOutputSchema = z.object({
  observations: z.array(LlmObservationSchema).max(20).default([]),
  events: z.array(LlmEventSchema).max(10).default([]),
  decisions: z.array(LlmDecisionSchema).max(10).default([]),
  outcomes: z.array(LlmOutcomeSchema).max(10).default([]),
  unknowns: z.array(LlmUnknownSchema).max(10).default([]),
  non_care_facts: z.array(LlmNonCareFactSchema).max(10).default([]),
  possible_links: z.array(LlmPossibleLinkSchema).max(10).default([]),
});

export type LlmUnderstandingOutput = z.infer<typeof LlmUnderstandingOutputSchema>;

/** Validate that output does NOT contain diagnosis/advice/empathy/causation in text fields. */
export function validateMedicalBoundary(output: LlmUnderstandingOutput): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  const diagnosisPatterns = [
    /\bdiagnos(?:ed|is|e)\b/i,
    /\byou should\b/i,
    /\byou need to\b/i,
    /\bi think\b/i,
    /\bit seems like\b/i,
    /\bi understand\b/i,
    /\bi'?m here for you\b/i,
    /\byou must\b/i,
    /\btreatment (?:plan|for)\b/i,
    /\bprescribe\b/i,
    /\bcondition (?:is|was|has)\s+(?:worsening|improving|stable)\b/i,
  ];

  const textFields = [
    ...output.observations.map((o) => o.description),
    ...output.events.map((e) => e.description),
    ...output.decisions.map((d) => d.description),
    ...output.outcomes.map((o) => o.description),
    ...output.unknowns.map((u) => u.question),
    ...output.non_care_facts.map((n) => n.text),
    ...output.possible_links.map((l) => l.text),
  ];

  for (const text of textFields) {
    for (const pattern of diagnosisPatterns) {
      if (pattern.test(text)) {
        failures.push(`forbidden pattern in text: "${text.slice(0, 60)}..." matches ${pattern}`);
        break;
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
