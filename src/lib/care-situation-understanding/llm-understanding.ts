import type { CareRealityExtractionResult } from "../care-reality-extraction/types";
import { extractCareRealityFromText } from "../care-reality-extraction/extract";
import { postJSON } from "@/api/client";
import {
  LlmUnderstandingOutputSchema,
  validateMedicalBoundary,
  type LlmUnderstandingOutput,
} from "./llm-schema";

/**
 * Map private Qwen typed output to existing CareRealityExtractionResult types.
 * Preserves backend-stable candidate IDs and maintains structure compatibility.
 */
function mapLlmOutputToExtractionResult(
  llm: LlmUnderstandingOutput,
  source: string,
): CareRealityExtractionResult {
  const observations = llm.observations.map((o) => ({
    id: o.candidate_id,
    layer: "observation" as const,
    description: o.description,
    approximate_time: o.approximate_time,
    source,
    confidence: o.confidence,
    raw_fragment: o.raw_fragment,
  }));

  const events = llm.events.map((e) => ({
    id: e.candidate_id,
    layer: "event" as const,
    description: e.description,
    time: e.time,
    participants: e.participants,
    related_observation_ids: [] as string[],
    raw_fragment: e.raw_fragment,
  }));

  const decisions = llm.decisions.map((d) => ({
    id: d.candidate_id,
    layer: "decision" as const,
    description: d.description,
    who: d.who,
    why: d.why,
    reason_unknown: d.reason_unknown,
    evidence_texts: [] as string[],
    alternatives: [] as string[],
    outcome: null as string | null,
    status: d.status,
    raw_fragment: d.raw_fragment,
  }));

  const outcomes = llm.outcomes.map((o) => ({
    id: o.candidate_id,
    layer: "outcome" as const,
    description: o.description,
    related_id: null as string | null,
    related_type: null as "decision" | "event" | null,
    time: null as string | null,
    evidence_texts: [] as string[],
    status: o.status,
    raw_fragment: o.raw_fragment,
  }));

  const unknowns = llm.unknowns.map((u) => ({
    id: u.candidate_id,
    layer: "unknown" as const,
    question: u.question,
    related_object_id: null as string | null,
    related_object_type: null as "observation" | "event" | "decision" | null,
    source,
    importance: "Needs to be checked with a caregiver.",
    status: u.status,
    raw_fragment: u.raw_fragment,
  }));

  const non_care_facts = llm.non_care_facts.map((n) => ({
    id: n.candidate_id,
    layer: n.layer as "contributor_load" | "disagreement_perspective",
    text: n.text,
    raw_fragment: n.raw_fragment,
  }));

  const relationships = llm.possible_links.map((l) => ({
    id: l.candidate_id,
    from_id: "",
    to_id: "",
    kind: "observation_to_observation" as const,
    certainty: "possible" as const,
    evidence_note: l.text,
  }));

  return {
    observations,
    events,
    decisions,
    actions: [],
    outcomes,
    unknowns,
    non_care_facts,
    relationships,
    observation_focus_lines: observations.map((o) =>
      o.description.endsWith(".") ? o.description : `${o.description}.`,
    ),
  };
}

/**
 * Extract care reality through authenticated backend Qwen inference.
 * Qwen failures are surfaced; this function never substitutes deterministic extraction.
 *
 * @param rawText - The caregiver's raw input text (any length, any structure)
 * @param contributorId - Optional contributor id for attribution
 * @returns A source-grounded CareRealityExtractionResult from backend Qwen; throws if validation fails.
 */
export async function llmStructuredUnderstanding(params: {
  rawText: string;
  evidenceId: string;
  contributorId?: string;
  signal?: AbortSignal;
}): Promise<CareRealityExtractionResult> {
  const source = params.rawText ?? "";
  const contributor = params.contributorId ?? "caregiver";
  if (!source.trim()) {
    throw new Error("Caregiver information is required before Qwen can process it.");
  }
  if (!params.evidenceId) {
    throw new Error("A saved care record is required before Qwen can process this information.");
  }

  const response = await postJSON("/assistant/care-understanding", {
    evidence_id: params.evidenceId,
    raw_text: source,
  }) as {
    evidence_id?: string;
    understanding?: unknown;
    provider?: string;
    written_to_lcr?: boolean;
    review_required?: boolean;
  };

  if (
    response.evidence_id !== params.evidenceId ||
    response.provider !== "private_ollama_qwen" ||
    response.written_to_lcr !== false ||
    response.review_required !== true
  ) {
    throw new Error("Qwen did not return a valid review-only care understanding.");
  }

  const validation = LlmUnderstandingOutputSchema.safeParse(response.understanding);
  if (!validation.success) {
    throw new Error("Qwen returned care information in an unexpected format. Nothing was added to the Care Record.");
  }
  const boundary = validateMedicalBoundary(validation.data);
  if (!boundary.ok) {
    throw new Error("Qwen returned care information outside SolenOS's safety boundaries.");
  }
  const candidateMetadata = [
    ...validation.data.observations.map((item) => ({ ...item, displayedText: item.description })),
    ...validation.data.events.map((item) => ({ ...item, displayedText: item.description })),
    ...validation.data.decisions.map((item) => ({ ...item, displayedText: item.description })),
    ...validation.data.outcomes.map((item) => ({ ...item, displayedText: item.description })),
    ...validation.data.unknowns.map((item) => ({ ...item, displayedText: item.question })),
    ...validation.data.non_care_facts.map((item) => ({ ...item, displayedText: item.text })),
    ...validation.data.possible_links.map((item) => ({ ...item, displayedText: item.text })),
  ];
  const candidateIds = candidateMetadata.map((item) => item.candidate_id);
  if (
    candidateMetadata.some((item) =>
      item.source_id !== params.evidenceId ||
      !source.includes(item.source_fragment) ||
      item.candidate_description !== item.displayedText
    ) ||
    new Set(candidateIds).size !== candidateIds.length
  ) {
    throw new Error("Qwen returned candidate metadata that did not match its source or stable identity.");
  }
  return mapLlmOutputToExtractionResult(validation.data, contributor);
}

/**
 * Synchronous deterministic-only understanding path.
 * Always uses regex/heuristic extraction — no LLM dependency.
 * Use when you need guaranteed synchronous execution.
 */
export function deterministicUnderstanding(params: {
  rawText: string;
  contributorId?: string;
}): CareRealityExtractionResult {
  return extractCareRealityFromText({
    rawText: params.rawText,
    source: params.contributorId ?? "caregiver",
  });
}
