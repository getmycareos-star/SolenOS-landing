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
 * Assigns unique in-memory IDs and maintains structure compatibility.
 */
function mapLlmOutputToExtractionResult(
  llm: LlmUnderstandingOutput,
  source: string,
): CareRealityExtractionResult {
  const observations = llm.observations.map((o, i) => ({
    id: `llm_obs_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: "observation" as const,
    description: o.description,
    approximate_time: o.approximate_time,
    source,
    confidence: o.confidence,
    raw_fragment: o.raw_fragment,
  }));

  const events = llm.events.map((e, i) => ({
    id: `llm_evt_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: "event" as const,
    description: e.description,
    time: e.time,
    participants: e.participants,
    related_observation_ids: [] as string[],
    raw_fragment: e.raw_fragment,
  }));

  const decisions = llm.decisions.map((d, i) => ({
    id: `llm_dec_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
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

  const outcomes = llm.outcomes.map((o, i) => ({
    id: `llm_out_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: "outcome" as const,
    description: o.description,
    related_id: null as string | null,
    related_type: null as "decision" | "event" | null,
    time: null as string | null,
    evidence_texts: [] as string[],
    status: o.status,
    raw_fragment: o.raw_fragment,
  }));

  const unknowns = llm.unknowns.map((u, i) => ({
    id: `llm_unk_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: "unknown" as const,
    question: u.question,
    related_object_id: null as string | null,
    related_object_type: null as "observation" | "event" | "decision" | null,
    source,
    importance: "Needs to be checked with a caregiver.",
    status: u.status,
    raw_fragment: u.raw_fragment,
  }));

  const non_care_facts = llm.non_care_facts.map((n, i) => ({
    id: `llm_ncf_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: n.layer as "contributor_load" | "disagreement_perspective",
    text: n.text,
    raw_fragment: n.raw_fragment,
  }));

  const relationships = llm.possible_links.map((l, i) => ({
    id: `llm_rel_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
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
  const fragments = [
    ...validation.data.observations.map((item) => item.raw_fragment),
    ...validation.data.events.map((item) => item.raw_fragment),
    ...validation.data.decisions.map((item) => item.raw_fragment),
    ...validation.data.outcomes.map((item) => item.raw_fragment),
    ...validation.data.unknowns.map((item) => item.raw_fragment),
    ...validation.data.non_care_facts.map((item) => item.raw_fragment),
  ];
  if (fragments.some((fragment) => !source.includes(fragment))) {
    throw new Error("Qwen returned a source quotation that could not be verified.");
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
