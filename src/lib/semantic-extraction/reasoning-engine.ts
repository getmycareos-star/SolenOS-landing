/**
 * Qwen Reasoning Engine — orchestrates multi-pass reasoning chain.
 *
 * Pass 1: Caregiver Intent & Emotional State
 * Pass 2: Cross-Observation Synthesis & Trajectory
 * Pass 3: Contradiction Resolution Hypotheses
 * Pass 4: Baseline Enrichment
 * Pass 5: Uncertainty Explanation
 *
 * Deterministic engines validate; Qwen proposes.
 * When the LLM is unavailable, returns degraded output with nulls.
 */

import { createLlmProvider } from "../llm-provider";
import {
  clearLlmUnavailable,
  isLlmMarkedUnavailable,
  markLlmUnavailable,
} from "../llm-provider/availability-memo";
import type { LlmProvider } from "../llm-provider";
import type { SemanticExtraction } from "./types";
import type { QwenReasoningOutput } from "./reasoning-types";
import {
  INTENT_PROMPT,
  SYNTHESIS_PROMPT,
  CONTRADICTION_PROMPT,
  BASELINE_PROMPT,
  UNCERTAINTY_PROMPT,
  REASONING_SYSTEM_MESSAGE,
} from "./reasoning-prompts";

/** Hard wall-clock budget for the whole multi-pass run. */
const REASONING_BUDGET_MS = Number(process.env.SEMANTIC_REASONING_BUDGET_MS ?? 8000);

/** Model used for the reasoning passes when one is reachable. */
const REASONING_MODEL = process.env.SEMANTIC_REASONING_MODEL ?? "qwen2.5-coder:7b";

export interface ReasoningInput {
  latestNote: string;
  extraction: SemanticExtraction;
  priorObservations: Array<{ raw_text: string; captured_at?: string | null }>;
  contradictions: Array<{ claim_a: string; claim_b: string; field: string }>;
}

export function createQwenReasoningEngine() {
  return new QwenReasoningEngine();
}

export class QwenReasoningEngine {
  private provider: LlmProvider | null = null;
  private providerPromise: Promise<LlmProvider> | null = null;

  private async getProvider(): Promise<LlmProvider | null> {
    if (this.provider) return this.provider;
    if (!this.providerPromise) {
      this.providerPromise = createLlmProvider({
        provider: "ollama",
        model: REASONING_MODEL,
        timeoutMs: Math.min(REASONING_BUDGET_MS, 30000),
        temperature: 0,
        maxTokens: 4096,
      }).catch(() => null as unknown as LlmProvider);
    }
    this.provider = await this.providerPromise;
    return this.provider;
  }

  async reason(input: ReasoningInput): Promise<QwenReasoningOutput> {
    const start = Date.now();
    const degraded = !input.extraction.source || input.extraction.source === "rules";

    if (degraded) {
      return this.degradedResult(start);
    }

    // If extraction just learned that no model answered, reasoning must not probe again.
    if (isLlmMarkedUnavailable()) {
      return this.degradedResult(start);
    }

    // Caregiving capture must never wait on a model. The multi-pass run is raced
    // against a hard budget; if the model is slow or unreachable the caregiver
    // still gets an answer, marked degraded.
    const budget = Math.max(1000, Math.min(REASONING_BUDGET_MS, 30000));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), budget);
      timer.unref?.();
    });
    try {
      const result = await Promise.race([this.runMultiPass(input, start), expiry]);
      return result ?? this.degradedResult(start);
    } catch {
      return this.degradedResult(start);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async runMultiPass(input: ReasoningInput, start: number): Promise<QwenReasoningOutput> {
    const provider = await this.getProvider();
    if (!provider || !(await provider.isAvailable().catch(() => false))) {
      markLlmUnavailable();
      return this.degradedResult(start);
    }
    clearLlmUnavailable();

    const model = REASONING_MODEL;
    const [intent, synthesis, contradictions, baseline, uncertainty] =
      await Promise.all([
        this.runPass(INTENT_PROMPT, buildIntentContext(input), provider, model),
        this.runPass(SYNTHESIS_PROMPT, buildSynthesisContext(input), provider, model),
        this.runPass(CONTRADICTION_PROMPT, buildContradictionContext(input), provider, model),
        this.runPass(BASELINE_PROMPT, buildBaselineContext(input), provider, model),
        this.runPass(UNCERTAINTY_PROMPT, buildUncertaintyContext(input), provider, model),
      ]);

    const summaryParts: string[] = [];
    if (intent?.summary) summaryParts.push(intent.summary);
    if (synthesis?.trend_summary) summaryParts.push(synthesis.trend_summary);
    if (baseline?.summary) summaryParts.push(baseline.summary);
    if (uncertainty?.summary) summaryParts.push(uncertainty.summary);

    const whatHelps: string[] = [];
    if (intent?.unspoken_needs) whatHelps.push(...intent.unspoken_needs.slice(0, 2));
    if (uncertainty?.explanations) {
      for (const u of uncertainty.explanations.slice(0, 2)) {
        whatHelps.push(u.would_help);
      }
    }

    return {
      intent_analysis: intent,
      cross_observation: synthesis,
      contradiction_resolutions: contradictions,
      baseline_enrichment: baseline,
      uncertainty_explanation: uncertainty,
      overall_summary: summaryParts.join(" ") || "Understanding is based on what was shared.",
      what_would_help_most: whatHelps.slice(0, 4),
      degraded: false,
      model,
      duration_ms: Date.now() - start,
    };
  }

  private degradedResult(start: number): QwenReasoningOutput {
    return {
      intent_analysis: null,
      cross_observation: null,
      contradiction_resolutions: null,
      baseline_enrichment: null,
      uncertainty_explanation: null,
      overall_summary: "Understanding is based on what was said. Some details may need clarification.",
      what_would_help_most: [],
      degraded: true,
      model: "rule-extraction-floor",
      duration_ms: Date.now() - start,
    };
  }

  private async runPass<T>(
    systemPrompt: string,
    userContext: string,
    provider: LlmProvider,
    model: string,
  ): Promise<T | null> {
    try {
      const result = await provider.invoke({
        model,
        messages: [
          { role: "system", content: `${REASONING_SYSTEM_MESSAGE}\n\n${systemPrompt}` },
          { role: "user", content: userContext },
        ],
        temperature: 0,
        maxTokens: 4096,
        timeoutMs: 30000,
        format: "json",
      });

      if (!result.success || !result.parsedContent) return null;
      return result.parsedContent as T;
    } catch {
      return null;
    }
  }
}

function buildIntentContext(input: ReasoningInput): string {
  return `CAREGIVER NOTE:\n${input.latestNote}`;
}

function buildSynthesisContext(input: ReasoningInput): string {
  const obsText = input.priorObservations
    .map((o) => `- ${o.raw_text}${o.captured_at ? ` (${o.captured_at.slice(0, 10)})` : ""}`)
    .join("\n");
  return `OBSERVATIONS (chronological):\n${obsText || "(no prior observations)"}`;
}

function buildContradictionContext(input: ReasoningInput): string {
  const contraText = input.contradictions
    .map((c) => `- field: ${c.field}, claim_a: "${c.claim_a}", claim_b: "${c.claim_b}"`)
    .join("\n");
  return `CONTRADICTIONS:\n${contraText || "(none)"}`;
}

function buildBaselineContext(input: ReasoningInput): string {
  const obsText = input.priorObservations
    .map((o) => `- ${o.raw_text}`)
    .join("\n");
  return `OBSERVATIONS:\n${obsText || "(no prior observations)"}`;
}

function buildUncertaintyContext(input: ReasoningInput): string {
  const extraction = input.extraction;
  const uncText = (extraction.uncertainties ?? [])
    .map((u) => `- ${u.field}: ${u.description}`)
    .join("\n");
  return `NOTE:\n${input.latestNote}\n\nSTATED UNCERTAINTIES:\n${uncText || "(none stated)"}`;
}