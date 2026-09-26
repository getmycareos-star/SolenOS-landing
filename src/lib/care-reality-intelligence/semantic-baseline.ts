/**
 * Semantic baseline enrichment — LLM-assisted prior→now reading with a rule floor.
 *
 * Boundary: the rule reading (`readBaselineLanguage`) is always returned. The model
 * may only *add* prior/now pairs it can quote back from the text; anything it cannot
 * ground is discarded. This is what lifts baseline comparison beyond cue regexes
 * without ever letting a model invent a baseline.
 *
 * Non-blocking contract: any failure, timeout, or unavailable model returns the
 * rule reading unchanged. Baseline understanding must never depend on the LLM.
 */

import { createLlmProvider } from "../llm-provider";
import type { LlmProvider } from "../llm-provider";
import {
  readBaselineLanguage,
  type BaselineReading,
  type QuantityComparison,
} from "./baseline-language";

const BASELINE_TIMEOUT_MS = Number(process.env.BASELINE_SEMANTIC_TIMEOUT_MS ?? 8000);
const BASELINE_MODEL = process.env.BASELINE_SEMANTIC_MODEL ?? "qwen2.5-coder:7b";

const SYSTEM = `You separate what was usual from what is happening now, using only the words given.
Rules:
- Copy spans verbatim from the text. Never invent, never infer, never diagnose.
- Return an empty array when the text does not actually say it.
- Return ONLY a JSON object: {"baseline": string[], "changes": string[], "onset": string[], "quantity_changes": [{"label": string, "current": number, "usual": number, "unit": string, "evidence": string}]}`;

let providerPromise: Promise<LlmProvider | null> | null = null;

async function getProvider(): Promise<LlmProvider | null> {
  if (!providerPromise) {
    providerPromise = createLlmProvider({
      provider: "ollama",
      model: BASELINE_MODEL,
      timeoutMs: BASELINE_TIMEOUT_MS,
      temperature: 0,
      maxTokens: 1024,
    }).catch(() => null);
  }
  return providerPromise;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Keep only spans that actually occur in the source text. */
function groundedSpans(spans: unknown, source: string): string[] {
  if (!Array.isArray(spans)) return [];
  const haystack = normalizeToken(source);
  const out: string[] = [];
  for (const span of spans) {
    if (typeof span !== "string") continue;
    const trimmed = span.trim();
    if (trimmed.length < 5 || trimmed.length > 220) continue;
    const needle = normalizeToken(trimmed);
    if (!needle) continue;
    if (haystack.includes(needle) && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function groundedQuantities(raw: unknown, source: string): QuantityComparison[] {
  if (!Array.isArray(raw)) return [];
  const out: QuantityComparison[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const current = Number(rec.current);
    const usual = Number(rec.usual);
    const evidence = typeof rec.evidence === "string" ? rec.evidence : "";
    const unit = typeof rec.unit === "string" ? rec.unit : "";
    if (!Number.isFinite(current) || !Number.isFinite(usual)) continue;
    if (Math.abs(current - usual) < 0.05) continue;
    if (evidence && !normalizeToken(source).includes(normalizeToken(evidence))) continue;
    const diff = Math.round((usual - current) * 10) / 10;
    out.push({
      domain: "general",
      label: typeof rec.label === "string" && rec.label.trim() ? rec.label.trim() : "quantity",
      current,
      baseline: usual,
      unit,
      direction: diff > 0 ? "lower_than_usual" : "higher_than_usual",
      difference_phrase: `about ${Math.abs(diff)} ${unit} ${diff > 0 ? "less" : "more"} than usual`,
      evidence: evidence || source.slice(0, 160),
    });
    if (out.length >= 3) break;
  }
  return out;
}

function mergeUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      target.push(value);
    }
  }
}

export type BaselineEnrichmentResult = {
  reading: BaselineReading;
  /** True when a model contributed at least one grounded span. */
  enriched: boolean;
  model: string | null;
  duration_ms: number;
  error: string | null;
};

const READING_CACHE = new Map<string, BaselineReading>();
const CACHE_LIMIT = 64;

function cacheKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 2000);
}

function noteReading(text: string, reading: BaselineReading): void {
  if (READING_CACHE.size >= CACHE_LIMIT) {
    const oldest = READING_CACHE.keys().next().value;
    if (oldest !== undefined) READING_CACHE.delete(oldest);
  }
  READING_CACHE.set(cacheKey(text), reading);
}

/**
 * Semantically enriched reading for this exact text, if one was already computed
 * on the async path. Lets the synchronous downstream engines (situation generator,
 * comparison engine, composer) consume model-enriched baseline reading without
 * ever becoming async themselves.
 */
export function cachedEnrichedReading(text: string): BaselineReading | null {
  return READING_CACHE.get(cacheKey(text)) ?? null;
}

/**
 * Read baseline discourse semantically, keeping the deterministic reading as the
 * floor. Never throws.
 */
export async function enrichBaselineSemantics(text: string): Promise<BaselineEnrichmentResult> {
  const start = Date.now();
  const rules = readBaselineLanguage(text);
  const trimmed = text.trim();
  if (trimmed.length < 12) {
    return { reading: rules, enriched: false, model: null, duration_ms: 0, error: null };
  }
  const already = cachedEnrichedReading(trimmed);
  if (already) {
    return { reading: already, enriched: true, model: "cache", duration_ms: 0, error: null };
  }
  // Nothing in the rule reading and no comparative language at all: skip the model.
  const comparative = /\b(?:but now|used to|usually|normally|always|no longer|anymore|different|since|before|normal|baseline|than)\b/i.test(
    trimmed,
  );
  if (!rules.has_prior && !rules.has_change && !comparative) {
    return { reading: rules, enriched: false, model: null, duration_ms: 0, error: null };
  }

  const provider = await getProvider();
  if (!provider) {
    return { reading: rules, enriched: false, model: null, duration_ms: Date.now() - start, error: "provider_unavailable" };
  }

  try {
    const response = await provider.invoke({
      model: BASELINE_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `CAREGIVER MESSAGE:\n${trimmed.slice(0, 2000)}\n\nReturn the JSON object.` },
      ],
      temperature: 0,
      maxTokens: 1024,
      timeoutMs: BASELINE_TIMEOUT_MS,
      format: "json",
    });

    if (!response.success || !response.parsedContent) {
      return {
        reading: rules,
        enriched: false,
        model: BASELINE_MODEL,
        duration_ms: Date.now() - start,
        error: response.error ?? "no_parsed_content",
      };
    }

    const payload = response.parsedContent as Record<string, unknown>;
    const baseline = groundedSpans(payload.baseline ?? payload.baselines, trimmed);
    const changes = groundedSpans(payload.changes ?? payload.change, trimmed);
    const onset = groundedSpans(payload.onset ?? payload.started, trimmed);
    const quantities = groundedQuantities(payload.quantity_changes ?? payload.quantities, trimmed);

    mergeUnique(rules.baseline_statements, baseline);
    mergeUnique(rules.change_statements, changes);
    mergeUnique(rules.onset_statements, onset);
    for (const q of quantities) {
      const duplicate = rules.quantity_comparisons.some(
        (existing) => existing.label === q.label && existing.current === q.current,
      );
      if (!duplicate) rules.quantity_comparisons.push(q);
    }

    rules.has_prior = rules.has_prior || baseline.length > 0;
    rules.has_change = rules.has_change || changes.length > 0 || quantities.length > 0;
    rules.has_quantity_change = rules.quantity_comparisons.length > 0;
    noteReading(trimmed, rules);

    return {
      reading: rules,
      enriched: baseline.length + changes.length + onset.length + quantities.length > 0,
      model: BASELINE_MODEL,
      duration_ms: Date.now() - start,
      error: null,
    };
  } catch (error) {
    return {
      reading: rules,
      enriched: false,
      model: BASELINE_MODEL,
      duration_ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
