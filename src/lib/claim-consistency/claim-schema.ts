import { z } from "zod";
import type { ConfidenceTag, EntityType, SourceSpan } from "./types";

export const ClaimSourceSpanSchema = z.object({
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().nonnegative(),
  text: z.string().min(1),
});

export const ExtractedClaimSchema = z.object({
  claim_text: z.string().min(1).max(1000),
  entity_type: z.enum([
    "person",
    "place",
    "institution",
    "object",
    "symptom",
    "behavior",
    "medication",
    "event",
    "unknown",
  ]),
  event_type: z.string().min(1).max(200),
  confidence_tag: z.enum(["confirmed", "reported", "inferred", "unknown", "contradictory"]),
  source_span: ClaimSourceSpanSchema.nullable(),
});

export const ClaimExtractionOutputSchema = z.object({
  claims: z.array(ExtractedClaimSchema).max(20).default([]),
});

export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionOutputSchema>;

export const CLAIM_EXTRACTION_SYSTEM_PROMPT = `You are the SolenOS Claim Extraction layer — a deterministic evidence parser, not a chatbot.

Your sole job is to extract discrete, source-anchored claims from caregiver input text.

For each claim you identify:
1. "claim_text" — the exact claim in caregiver's own words (or closest paraphrase)
2. "entity_type" — the primary entity kind: person, place, institution, object, symptom, behavior, medication, event, or unknown
3. "event_type" — a short string classifying the claim (e.g., "medication_change", "hospital_discharge", "symptom_observed")
4. "confidence_tag" — your confidence in this claim:
   - "confirmed" — explicitly stated, unambiguous, directly supported by text
   - "reported" — secondhand or attributed to someone else
   - "inferred" — reasonable inference but not directly stated
   - "unknown" — unclear or insufficient evidence
   - "contradictory" — text contains conflicting information about this claim
5. "source_span" — the exact character offsets in the original text that support this claim:
   - start_offset: character index where supporting text begins
   - end_offset: character index where supporting text ends
   - text: the exact substring from the original text

RULES:
- Every claim MUST have a source_span with exact offsets from the original text
- If you cannot identify exact offsets, set source_span to null
- Prefer precision over recall — only extract claims with clear textual support
- Never invent claims not present in the text
- Never combine unrelated fragments into one claim
- Split compound sentences into separate claims when they describe distinct facts
- Output ONLY valid JSON matching the schema — no markdown, no explanations`;
