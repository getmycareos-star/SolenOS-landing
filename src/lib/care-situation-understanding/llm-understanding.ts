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
 * Never loses caregiver input. Never feeds /api/analyze 5-field compression to caregiver panel.
 */
import type { CareRealityExtractionResult } from "../care-reality-extraction/types";
import { extractCareRealityFromText } from "../care-reality-extraction/extract";
import { CARE_UNDERSTANDING_LLM_SYSTEM_PROMPT } from "./llm-prompt";
import {
  LlmUnderstandingOutputSchema,
  validateMedicalBoundary,
  type LlmUnderstandingOutput,
} from "./llm-schema";

/**
 * Map LLM typed output to existing CareRealityExtractionResult types.
 * Assigns stable IDs and maintains structure compatibility.
 */
function mapLlmOutputToExtractionResult(
  llm: LlmUnderstandingOutput,
): CareRealityExtractionResult {
  const observations = llm.observations.map((o, i) => ({
    id: `llm_obs_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    layer: "observation" as const,
    description: o.description,
    approximate_time: o.approximate_time,
    source: "caregiver",
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
    source: "caregiver",
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
  const { rawText } = params;
  const source = params.contributorId ?? "caregiver";

  // Trim excessively long input — LLM context preserved but extraction bounded
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return extractCareRealityFromText({ rawText: "", source });
  }

  // Check if Gemini API key is available
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.length === 0) {
    // Fallback to deterministic extraction when no LLM available
    return extractCareRealityFromText({ rawText: trimmedText, source });
  }

  try {
    // Dynamic import to avoid hard dependency when LLM not used
    const { ChatGoogleGenerativeAI } = await import(
      "@langchain/google-genai"
    );
    const { HumanMessage, SystemMessage } = await import(
      "@langchain/core/messages"
    );

    const model = new ChatGoogleGenerativeAI({
      model: process.env.SOLENOS_LLM_MODEL ?? "gemini-2.0-flash",
      apiKey,
      temperature: 0,
      maxRetries: 0,
    });

    const response = await model.invoke(
      [
        new SystemMessage(CARE_UNDERSTANDING_LLM_SYSTEM_PROMPT),
        new HumanMessage(trimmedText),
      ],
      { signal: params.signal },
    );

    const content =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c) => (typeof c === "string" ? c : "")).join("")
          : "";

    // Extract JSON from response (handle markdown-wrapped JSON)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return extractCareRealityFromText({ rawText: trimmedText, source });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate against Zod schema
    const validation = LlmUnderstandingOutputSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn(
        "[llm-understanding] Zod validation failed:",
        validation.error.issues.map((i) => i.message).join("; "),
      );
      return extractCareRealityFromText({ rawText: trimmedText, source });
    }

    const validated: LlmUnderstandingOutput = validation.data;

    // Medical boundary check — forbid diagnosis/advice/empathy/causation
    const boundary = validateMedicalBoundary(validated);
    if (!boundary.ok) {
      console.warn(
        "[llm-understanding] Medical boundary violation:",
        boundary.failures.join("; "),
      );
      return extractCareRealityFromText({ rawText: trimmedText, source });
    }

    // Map to existing types and return
    return mapLlmOutputToExtractionResult(validated);
  } catch (err: unknown) {
    console.warn(
      "[llm-understanding] LLM extraction failed, falling back to deterministic:",
      err instanceof Error ? err.message : String(err),
    );
    return extractCareRealityFromText({ rawText: trimmedText, source });
  }
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
