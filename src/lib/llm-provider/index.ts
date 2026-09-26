/** LLM provider boundary — model-agnostic interface for structured extraction. */

import type { LlmRequestOptions, LlmResponse, LlmProviderConfig } from "./types";

export interface LlmProvider {
  readonly provider: string;
  readonly model: string;
  readonly config: LlmProviderConfig;
  invoke(options: LlmRequestOptions): Promise<LlmResponse>;
  isAvailable(): Promise<boolean>;
  cancel(): void;
  /** Model tags this provider can serve locally — used to skip absent models. */
  listLocalModels?(): Promise<string[]>;
}

export type CreateLlmProviderOptions = {
  provider?: "ollama";
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
};

export async function createLlmProvider(
  options: CreateLlmProviderOptions = {},
): Promise<LlmProvider> {
  const providerType = options.provider ?? "ollama";
  const model = options.model ?? "qwen2.5-coder:1.5b";
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const timeoutMs = options.timeoutMs ?? 120000;
  const temperature = options.temperature ?? 0.1;
  const maxTokens = options.maxTokens ?? 4096;

  const config: LlmProviderConfig = {
    provider: providerType,
    model,
    baseUrl,
    timeoutMs,
    temperature,
    maxTokens,
  };

  if (providerType === "ollama") {
    const { OllamaProvider } = await import("./ollama-provider");
    return new OllamaProvider(config);
  }

  throw new Error(`Unsupported LLM provider: ${providerType}`);
}