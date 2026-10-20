/**
 * Person model extractor — Qwen reads caregiver input for lived experience.
 *
 * Boundary: this layer extracts what the person *said* or what family *reported*.
 * It never invents a value, goal, fear, or life story. Every entry carries its
 * source and confidence. When the input does not say something, the field is
 * absent — never filled in by assumption.
 */

import { createLlmProvider } from "../llm-provider";
import {
  isEndpointUnreachable,
  isLlmMarkedUnavailable,
  markLlmUnavailable,
} from "../llm-provider/availability-memo";
import type { LlmProvider } from "../llm-provider";
import { PERSON_EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import type { PersonExtractionResult, ExtractedPersonValue } from "./extraction";

// A person model is derived depth, not a prerequisite: a slow answer must not
// hold a capture hostage while the caregiver's own words are already waiting.
const PERSON_TIMEOUT_MS = Number(process.env.PERSON_EXTRACTION_TIMEOUT_MS ?? 8000);
const PERSON_MODEL = process.env.PERSON_EXTRACTION_MODEL ?? "qwen2.5-coder:7b";

function groundedSpan(span: unknown, source: string): string | null {
  if (typeof span !== "string") return null;
  const trimmed = span.trim();
  if (trimmed.length < 5 || trimmed.length > 400) return null;
  const haystack = source.toLowerCase();
  const needle = trimmed.toLowerCase();
  if (!haystack.includes(needle)) return null;
  return trimmed;
}

function groundedValues(raw: unknown, source: string): ExtractedPersonValue[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractedPersonValue[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const evidence = groundedSpan(rec.evidence, source);
    if (!text || !evidence) continue;
    const sourceKind: "stated" | "inferred" | "family_reported" =
      rec.source === "stated" || rec.source === "inferred" || rec.source === "family_reported"
        ? rec.source
        : "inferred";
    const confidence = typeof rec.confidence === "number" ? Math.max(0, Math.min(1, rec.confidence)) : 0.5;
    out.push({ text, source: sourceKind, confidence, evidence });
  }
  return out;
}

export type PersonExtractionOptions = {
  text: string;
  provider?: LlmProvider;
  model?: string;
  timeoutMs?: number;
};

export type PersonExtractionOutcome = {
  result: PersonExtractionResult;
  provider: string;
  model: string;
  durationMs: number;
};

/**
 * Extract lived experience from caregiver text.
 * Always returns a result: LLM when it works, empty arrays otherwise.
 * Never throws.
 */
export async function extractPersonModel(
  options: PersonExtractionOptions,
): Promise<PersonExtractionOutcome> {
  const start = Date.now();
  const text = options.text.trim();
  const model = options.model ?? PERSON_MODEL;
  const timeoutMs = Math.max(2000, Math.min(options.timeoutMs ?? PERSON_TIMEOUT_MS, 60000));

  const empty = (): PersonExtractionResult => ({
    version: "1.0.0",
    values: [],
    goals: [],
    fears: [],
    goodDayDefinitions: [],
    lifeStory: [],
    relationships: [],
    cognitivePatterns: [],
    extractionConfidence: 0,
    source: "rules",
    degraded: true,
    rawResponse: "",
    model: "rule-extraction-floor",
    durationMs: 0,
  });

  if (text.length < 12) {
    return { result: { ...empty(), durationMs: Date.now() - start }, provider: "deterministic", model: "rule-extraction-floor", durationMs: Date.now() - start };
  }

  // The rule floor already answers; do not re-probe a provider known to be down.
  if (!options.provider && isLlmMarkedUnavailable()) {
    return { result: { ...empty(), durationMs: Date.now() - start }, provider: "deterministic", model: "rule-extraction-floor", durationMs: Date.now() - start };
  }

  let provider = options.provider;
  if (!provider) {
    try {
      provider = await createLlmProvider({ provider: "ollama", model, timeoutMs, temperature: 0, maxTokens: 4096 });
    } catch {
      markLlmUnavailable();
      return { result: { ...empty(), durationMs: Date.now() - start }, provider: "deterministic", model: "rule-extraction-floor", durationMs: Date.now() - start };
    }
  }

  try {
    const response = await provider.invoke({
      model,
      messages: [
        { role: "system", content: PERSON_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `CAREGIVER INPUT:\n${text}\n\nReturn ONLY the JSON object.` },
      ],
      temperature: 0,
      maxTokens: 4096,
      timeoutMs,
      format: "json",
    });

    if (!response.success || !response.parsedContent) {
      if (isEndpointUnreachable(response.error)) markLlmUnavailable();
      return { result: { ...empty(), rawResponse: response.content, durationMs: Date.now() - start, model }, provider: response.provider, model, durationMs: Date.now() - start };
    }

    const payload = response.parsedContent as Record<string, unknown>;
    const values = groundedValues(payload.values, text);

    const result: PersonExtractionResult = {
      version: "1.0.0",
      values,
      goals: [],
      fears: [],
      goodDayDefinitions: [],
      lifeStory: [],
      relationships: [],
      cognitivePatterns: [],
      extractionConfidence: typeof payload.extractionConfidence === "number" ? payload.extractionConfidence : values.length > 0 ? 0.7 : 0,
      source: "llm",
      degraded: false,
      rawResponse: response.content,
      model,
      durationMs: response.durationMs,
    };

    return { result, provider: response.provider, model, durationMs: Date.now() - start };
  } catch (error) {
    if (isEndpointUnreachable(error)) markLlmUnavailable();
    return { result: { ...empty(), durationMs: Date.now() - start }, provider: provider.provider, model, durationMs: Date.now() - start };
  }
}