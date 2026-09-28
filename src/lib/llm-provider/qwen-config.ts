/**
 * Qwen configuration — model ladder, timeouts, provider selection.
 *
 * Local-first: Ollama is the default. Qwen cloud is opt-in and used only
 * for long-context / high-quality document reasoning where the local
 * model is insufficient.
 *
 * Every knob is an env var so deployments can tune without code changes.
 */

/** Default Qwen cloud models, strongest-first. Capability matters more than size. */
export const QWEN_MODEL_LADDER: string[] = (
  process.env.QWEN_MODELS ??
  "qwen3.8-max,qwen3.7-max,qwen3.7-plus,qwen3.5-plus,qwen3.5-flash"
)
  .split(",")
  .map((m: string) => m.trim())
  .filter(Boolean);

/** Larger models for document reasoning when quality matters more than latency. */
export const QWEN_DOCUMENT_MODELS: string[] = (
  process.env.QWEN_DOCUMENT_MODELS ?? "qwen3.8-max,qwen3.7-max,qwen3.5-plus"
)
  .split(",")
  .map((m: string) => m.trim())
  .filter(Boolean);

/** Models for long-context baseline/trajectory reasoning. */
export const QWEN_CONTEXT_MODELS: string[] = (
  process.env.QWEN_CONTEXT_MODELS ?? "qwen3.8-max,qwen3.7-max"
)
  .split(",")
  .map((m: string) => m.trim())
  .filter(Boolean);

/** Wall-clock ceiling for a single Qwen call (ms). */
export const QWEN_TIMEOUT_MS = Math.max(
  2000,
  Math.min(Number(process.env.QWEN_TIMEOUT_MS ?? 60000), 300000),
);

/** Total budget for a Qwen ladder run (ms). */
export const QWEN_TOTAL_BUDGET_MS = Math.max(
  5000,
  Math.min(Number(process.env.QWEN_TOTAL_BUDGET_MS ?? 120000), 600000),
);

/** How long a Qwen endpoint failure is memoized before probing again (ms). */
export const QWEN_UNAVAILABLE_TTL_MS = Math.max(
  1000,
  Math.min(Number(process.env.QWEN_UNAVAILABLE_TTL_MS ?? 300000), 900000),
);

/** Default temperature for Qwen structured extraction. */
export const QWEN_TEMPERATURE = Number(process.env.QWEN_TEMPERATURE ?? 0);

/** Default max tokens for Qwen responses. */
export const QWEN_MAX_TOKENS = Number(process.env.QWEN_MAX_TOKENS ?? 8192);

/** Base URL for Qwen cloud (Alibaba Cloud Model Studio, OpenAI-compatible). */
export function qwenBaseUrl(): string {
  return (
    process.env.QWEN_BASE_URL ??
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  );
}

/** API key for Qwen cloud. */
export function qwenApiKey(): string | undefined {
  return (
    process.env.QWEN_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    undefined
  );
}

/** Whether Qwen cloud is configured and usable. */
export function qwenCloudEnabled(): boolean {
  return Boolean(qwenApiKey());
}

/** Whether local Ollama is the primary provider. */
export function qwenLocalEnabled(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST);
}

/**
 * Resolve which Qwen provider to use for a given task class.
 * Local-first: Ollama is tried first. Cloud is the fallback/escalation path
 * for document reasoning and long-context work where the local model is
 * too small or too slow.
 */
export function resolveQwenProvider(task: "extraction" | "document" | "context" | "reasoning"): {
  provider: "ollama" | "qwen";
  model: string;
  baseUrl: string;
  apiKey?: string;
} {
  const useCloud = process.env.QWEN_USE_CLOUD === "1" || process.env.QWEN_USE_CLOUD === "true";
  const cloudOnly = process.env.QWEN_CLOUD_ONLY === "1";

  if (cloudOnly || (useCloud && qwenCloudEnabled())) {
    const ladder = task === "document" || task === "context"
      ? QWEN_DOCUMENT_MODELS
      : QWEN_MODEL_LADDER;
    return {
      provider: "qwen",
      model: ladder[0] ?? "qwen3.5-plus",
      baseUrl: qwenBaseUrl(),
      apiKey: qwenApiKey(),
    };
  }

  // Local-first
  const localModel =
    task === "document" || task === "context"
      ? process.env.SEMANTIC_REASONING_MODEL ??
        "qwen2.5-coder:7b"
      : process.env.SEMANTIC_REASONING_MODEL ?? "qwen2.5-coder:7b";
  return {
    provider: "ollama",
    model: localModel,
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  };
}