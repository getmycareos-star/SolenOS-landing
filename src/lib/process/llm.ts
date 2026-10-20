/**
 * Bounded probabilistic transforms (LLM) — optional.
 * Allowed ONLY for: signal extraction, classification support, prioritization heuristics.
 * Must return structured data; validated before commit; never mutates state directly.
 */
import type { ClassificationResult } from "./classification";
import type { SignalVector } from "./types";

export interface LlmEnhancement {
  classification?: ClassificationResult;
  signals?: Partial<SignalVector>;
}

/** Returns null when LLM unavailable — deterministic fallback used. */
export async function enhanceWithLlm(
  _raw: string,
  _deterministic: { classification: ClassificationResult; signals: SignalVector },
): Promise<LlmEnhancement | null> {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return null;
  }
  // v1: bounded LLM hook — not wired; deterministic path only
  return null;
}

export function mergeEnhancement(
  signals: SignalVector,
  enhancement: LlmEnhancement | null,
): SignalVector {
  if (!enhancement?.signals) return signals;
  return {
    ...signals,
    ...enhancement.signals,
    inferred: [
      ...signals.inferred,
      ...(enhancement.signals.inferred ?? []).map((i) => ({
        ...i,
        signal: `[llm] ${i.signal}`,
      })),
    ],
  };
}
