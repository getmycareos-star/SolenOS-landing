/**
 * Semantic extraction — model ladder, tolerant repair, deterministic rule floor.
 *
 * Design (replaces single-model "qwen2.5-coder:1.5b or nothing"):
 * 1. A ladder of installed models is tried strongest-first. A 1.5b model is no
 *    longer the only option, and one weak model never ends extraction.
 * 2. Any model response is repaired/salvaged (`normalizeExtraction`) instead of
 *    being discarded for a missing field or a fenced code block.
 * 3. The rule floor always runs and is merged in, so `extraction` is never null
 *    and never empty of everything the caregiver actually said.
 *
 * Boundaries: extraction only — no diagnosis, no triage, no invented precision.
 */

import { createLlmProvider } from "../llm-provider";
import type { LlmProvider } from "../llm-provider";
import type { ExtractionCoverage, ExtractionResult, SemanticExtraction } from "./types";
import { buildExtractionPrompt } from "./prompt";
import { extractWithRules } from "./rule-extractor";
import { extractionCoverage, mergeExtractions, normalizeExtraction, salvageJson } from "./normalize";
import { createQwenReasoningEngine, type ReasoningInput } from "./reasoning-engine";

const EXTRACTION_TIMEOUT_MS = Number(process.env.SEMANTIC_EXTRACTION_TIMEOUT_MS ?? 30000);

/**
 * Wall-clock ceiling for the whole ladder. A caregiver waiting at 11pm is not served
 * by a 3-minute model hunt: when the budget is spent, the rule floor answers.
 */
const EXTRACTION_TOTAL_BUDGET_MS = Number(process.env.SEMANTIC_EXTRACTION_TOTAL_BUDGET_MS ?? 25000);

/**
 * Strongest-first. Capability order matters more than raw size: instruction
 * following on strict JSON is what extraction needs.
 */
export const EXTRACTION_MODEL_LADDER: string[] = (
  process.env.SEMANTIC_EXTRACTION_MODELS ??
  "qwen2.5-coder:7b,qwen2.5:7b,qwen2.5-coder:3b,qwen2.5-coder:1.5b"
)
  .split(",")
  .map((m: string) => m.trim())
  .filter(Boolean);

/** Opt-in larger models when quality matters more than latency. */
const ESCALATION_MODELS: string[] = (process.env.SEMANTIC_EXTRACTION_ESCALATION_MODELS ?? "")
  .split(",")
  .map((m: string) => m.trim())
  .filter(Boolean);

const EXTRACTION_SYSTEM_MESSAGE =
  "You extract structured facts from caregiver notes. Return ONLY one JSON object matching the requested schema. Never diagnose. Never invent facts.";

function clampTimeout(): number {
  return Math.max(2000, Math.min(EXTRACTION_TIMEOUT_MS, 120000));
}

function clampTotalBudget(): number {
  return Math.max(3000, Math.min(EXTRACTION_TOTAL_BUDGET_MS, 180000));
}

function factCount(coverage: ExtractionCoverage): number {
  return (
    coverage.observations +
    coverage.measurements +
    coverage.medications +
    coverage.temporal_facts +
    coverage.questions +
    coverage.appointments +
    coverage.caregiver_load_signals
  );
}

export class SemanticExtractor {
  private provider: LlmProvider | null = null;
  private providerPromise: Promise<LlmProvider> | null = null;
  private localModels: string[] | null = null;

  private async getProvider(): Promise<LlmProvider> {
    if (this.provider) return this.provider;
    if (!this.providerPromise) {
      this.providerPromise = createLlmProvider({
        provider: "ollama",
        model: EXTRACTION_MODEL_LADDER[0] ?? "qwen2.5-coder:1.5b",
        timeoutMs: clampTimeout(),
        temperature: 0,
        maxTokens: 4096,
      });
    }
    this.provider = await this.providerPromise;
    return this.provider;
  }

  private async installedModels(): Promise<string[] | null> {
    if (this.localModels) return this.localModels;
    try {
      const provider = await this.getProvider();
      if (!provider.listLocalModels) return null;
      this.localModels = await provider.listLocalModels();
      return this.localModels;
    } catch {
      return null;
    }
  }

  /**
   * Models to try, in order, filtered to what is actually installed.
   * A bare tag ("qwen2.5-coder") matches any installed variant of it.
   */
  private async resolveLadder(): Promise<string[]> {
    const requested = [...ESCALATION_MODELS, ...EXTRACTION_MODEL_LADDER];
    const installed = await this.installedModels();
    if (!installed || installed.length === 0) return requested;
    const matches = (candidate: string): string | null => {
      const wanted = candidate.toLowerCase();
      const exact = installed.find((m) => m.toLowerCase() === wanted);
      if (exact) return exact;
      const base = wanted.split(":")[0]!;
      return (
        installed.find((m) => m.toLowerCase().split(":")[0] === base) ?? null
      );
    };
    const out: string[] = [];
    for (const candidate of requested) {
      const resolved = matches(candidate);
      if (resolved && !out.includes(resolved)) out.push(resolved);
    }
    return out;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const provider = await this.getProvider();
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Always returns a usable extraction: LLM when it works, rule floor otherwise.
   * `success` stays true whenever an extraction exists, so callers no longer need
   * a "failed" branch to keep understanding alive.
   */
  async extract(note: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    const text = note.trim();

    if (!text) {
      return {
        success: false,
        extraction: null,
        raw_response: "",
        parsed_content: null,
        duration_ms: 0,
        model: "rule-extraction-floor",
        provider: "deterministic",
        error: "empty_input",
      };
    }

    const rules = extractWithRules(text);
    const rulesCoverage = extractionCoverage(rules);
    const deadline = startTime + clampTotalBudget();

    let provider: LlmProvider;
    try {
      provider = await this.getProvider();
    } catch (error) {
      return this.rulesResult(
        rules,
        startTime,
        `provider_init_failed:${error instanceof Error ? error.message : String(error)}`,
        [],
      );
    }

    if (!(await provider.isAvailable())) {
      return this.rulesResult(rules, startTime, "llm_unavailable", []);
    }

    const ladder = await this.resolveLadder();
    const modelsAttempted: string[] = [];
    const repairNotes: string[] = [];
    let lastError: string | null = null;

    for (const model of ladder) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        lastError = "budget_exhausted";
        break;
      }
      modelsAttempted.push(model);
      const result = await provider.invoke({
        model,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_MESSAGE },
          { role: "user", content: buildExtractionPrompt(text) },
        ],
        temperature: 0,
        maxTokens: 4096,
        timeoutMs: Math.max(2000, Math.min(clampTimeout(), remaining)),
        format: "json",
      });

      if (!result.success) {
        lastError = result.error ?? "invoke_failed";
        continue;
      }

      const parsed = result.parsedContent ?? salvageJson(result.content);
      const normalized = normalizeExtraction(parsed);
      repairNotes.push(...normalized.notes);

      if (normalized.extraction) {
        const merged = mergeExtractions(normalized.extraction, rules);
        return {
          success: true,
          extraction: merged,
          raw_response: result.content,
          parsed_content: parsed,
          duration_ms: Date.now() - startTime,
          model,
          provider: result.provider,
          error: null,
          models_attempted: modelsAttempted,
          repair_notes: repairNotes,
          rule_floor_facts: factCount(rulesCoverage),
        };
      }

      lastError = normalized.notes.join("; ") || "no_structured_items";
    }

    // Every model answered unusably — the rule floor is the product answer.
    return this.rulesResult(rules, startTime, lastError, modelsAttempted, repairNotes);
  }

  private rulesResult(
    rules: SemanticExtraction,
    startTime: number,
    error: string | null,
    modelsAttempted: string[],
    repairNotes: string[] = [],
  ): ExtractionResult {
    const coverage = extractionCoverage(rules);
    return {
      success: true,
      extraction: { ...rules, degraded: true, source: "rules", coverage },
      raw_response: "",
      parsed_content: null,
      duration_ms: Date.now() - startTime,
      model: "rule-extraction-floor",
      provider: "deterministic",
      error,
      models_attempted: modelsAttempted,
      repair_notes: repairNotes,
      rule_floor_facts: factCount(coverage),
    };
  }
}

export function createSemanticExtractor(): SemanticExtractor {
  return new SemanticExtractor();
}
