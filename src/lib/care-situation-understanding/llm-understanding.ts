/**
 * LLM Understanding Orchestrator.
 *
 * Tries structured LLM extraction first (Gemini) with Zod validation + medical boundary check.
 * Falls back to deterministic/regex extraction (existing path) when:
 * - No API key is available
 * - LLM call fails
 * - LLM output fails Zod validation
 * - LLM output violates medical boundary (diagnosis/advice/empathy/causation)
 *
 * Incorporates SolenOS AI Constitution principles:
 * - 4-step thinking model (determine_goal, question_type, depends_on_record, estimate_confidence)
 * - Knowledge hierarchy (Living Care Record > conversation > medical > general > inference)
 * - Care intelligence signal detection
 * - Never loses caregiver input. Never feeds /api/analyze 5-field compression to caregiver panel.
 */
import type { CareRealityExtractionResult } from "../care-reality-extraction/types";
import { extractCareRealityFromText } from "../care-reality-extraction/extract";
import { postJSON } from "@/api/client";
import {
  LlmUnderstandingOutputSchema,
  validateMedicalBoundary,
  type LlmUnderstandingOutput,
} from "./llm-schema";
import {
  classifyQuestionType,
  estimateConfidence,
  detectCareIntelligenceSignal,
  dependsOnLivingCareRecord,
} from "../solenos-constitution";

/**
 * Map LLM typed output to existing CareRealityExtractionResult types.
 * Assigns stable IDs and maintains structure compatibility.
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
    importance: "Identified by structured understanding layer — needs confirmation.",
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
 * Attempt to extract care reality using Gemini LLM for structured understanding.
 * Falls back to deterministic/regex extraction on any failure.
 *
 * @param rawText - The caregiver's raw input text (any length, any structure)
 * @param contributorId - Optional contributor id for attribution
 * @returns CareRealityExtractionResult from LLM (if successful) or deterministic fallback
 */
export async function llmStructuredUnderstanding(params: {
  rawText: string;
  contributorId?: string;
  signal?: AbortSignal;
}): Promise<CareRealityExtractionResult> {
  const source = params.rawText ?? "";
  if (!source.trim()) {
    return extractCareRealityFromText({ rawText: "", source: params.contributorId ?? "caregiver" });
  }

  const response = await postJSON("/assistant/care-understanding", {
    raw_text: source,
  }) as {
    understanding?: unknown;
    provider?: string;
    written_to_lcr?: boolean;
    review_required?: boolean;
  };

  if (
    response.provider !== "private_ollama_qwen" ||
    response.written_to_lcr !== false ||
    response.review_required !== true
  ) {
    throw new Error("The Qwen care-understanding response did not meet the review-only contract.");
  }

  const validation = LlmUnderstandingOutputSchema.safeParse(response.understanding);
  if (!validation.success) {
    throw new Error("Qwen returned care-understanding data that did not match the required format.");
  }

  const boundary = validateMedicalBoundary(validation.data);
  if (!boundary.ok) {
    throw new Error("Qwen returned care-understanding data outside SolenOS's safety boundaries.");
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

  return mapLlmOutputToExtractionResult(validation.data, params.contributorId ?? "caregiver");
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
