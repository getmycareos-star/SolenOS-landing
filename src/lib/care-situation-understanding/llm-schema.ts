/**
 * Zod schema for validating LLM Structured Understanding output.
 * Must validate against the same shape as CareRealityExtractionResult
 * to ensure downstream compatibility.
 */
import { z } from "zod";

const LlmCandidateMetadataSchema = z.object({
  candidate_id: z.string().min(1),
  candidate_type: z.enum([
    "observations",
    "events",
    "decisions",
    "outcomes",
    "unknowns",
    "non_care_facts",
    "possible_links",
  ]),
  candidate_description: z.string().min(1).max(500),
  source_id: z.string().min(1),
  source_fragment: z.string().min(1),
  recorded_at: z.string().nullable(),
  recorded_time_status: z.enum(["available", "unavailable"]),
  person: z.object({
    id: z.string().nullable(),
    resolution_status: z.enum(["resolved", "unresolved"]),
  }),
  care_recipient_id: z.string().min(1),
  event_time: z.string().nullable(),
  event_time_resolution: z.enum(["unresolved", "missing"]),
  epistemic_status: z.enum(["reported", "inferred", "uncertain", "conflicting", "missing"]),
  confidence: z.literal("unavailable"),
  review_state: z.literal("pending"),
});

export const LlmObservationSchema = LlmCandidateMetadataSchema.extend({
  description: z.string().min(1).max(500),
  approximate_time: z.string().nullable(),
  raw_fragment: z.string().min(1),
});

export const LlmEventSchema = LlmCandidateMetadataSchema.extend({
  description: z.string().min(1).max(500),
  time: z.string().nullable(),
  participants: z.array(z.string()).max(10),
  raw_fragment: z.string().min(1),
});

export const LlmDecisionSchema = LlmCandidateMetadataSchema.extend({
  description: z.string().min(1).max(500),
  who: z.array(z.string()).max(10),
  why: z.string().nullable(),
  reason_unknown: z.boolean(),
  status: z.enum(["active", "completed", "changed", "reversed", "uncertain", "needs_review", "pending"]),
  raw_fragment: z.string().min(1),
});

export const LlmOutcomeSchema = LlmCandidateMetadataSchema.extend({
  description: z.string().min(1).max(500),
  status: z.enum(["observed", "pending", "uncertain", "ongoing", "resolved", "changed"]),
  raw_fragment: z.string().min(1),
});

export const LlmUnknownSchema = LlmCandidateMetadataSchema.extend({
  question: z.string().min(1).max(500),
  status: z.literal("open"),
  raw_fragment: z.string().min(1),
});

export const LlmNonCareFactSchema = LlmCandidateMetadataSchema.extend({
  layer: z.enum(["contributor_load", "disagreement_perspective"]),
  text: z.string().min(1).max(500),
  raw_fragment: z.string().min(1),
});

export const LlmPossibleLinkSchema = LlmCandidateMetadataSchema.extend({
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
