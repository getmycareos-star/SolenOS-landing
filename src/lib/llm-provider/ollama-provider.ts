/** Ollama provider implementation — HTTP client for Ollama API. */

import type { LlmRequestOptions, LlmResponse, LlmProviderConfig } from "./types";

const MODEL_LIST_TIMEOUT_MS = 5000;

export class OllamaProvider {
  readonly provider = "ollama";
  readonly model: string;
  readonly config: LlmProviderConfig;
  private abortController: AbortController | null = null;

  constructor(config: LlmProviderConfig) {
    this.config = config;
    this.model = config.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Model tags installed locally (e.g. "qwen2.5-coder:7b"). */
  async listLocalModels(): Promise<string[]> {
    try {
      // Bounded like the availability probe: a model list is a nice-to-have, and a
      // caregiver must never wait on a socket that never answers.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${this.config.baseUrl}/api/tags`, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: { name?: string; model?: string }[] };
      return (data.models ?? [])
        .map((m) => m.name ?? m.model ?? "")
        .filter((name): name is string => Boolean(name));
    } catch {
      return [];
    }
  }

  async invoke(options: LlmRequestOptions): Promise<LlmResponse> {
    const model = options.model ?? this.model;
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const timeout = setTimeout(() => this.abortController?.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? this.config.temperature,
          num_predict: options.maxTokens ?? this.config.maxTokens,
        },
      };

      if (options.format === "json") {
        body.format = "json";
      }

      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Ollama API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const message = (data as { message?: { content?: string } }).message;
      const content = message?.content ?? "";

      let parsedContent: unknown = null;
      if (content) {
        try {
          parsedContent = JSON.parse(content);
        } catch {
          parsedContent = null;
        }
      }

      const durationMs = Date.now() - startTime;

      return {
        provider: this.provider,
        model,
        content,
        parsedContent,
        durationMs,
        inputTokens: (data as { prompt_eval_count?: number }).prompt_eval_count ?? null,
        outputTokens: (data as { eval_count?: number }).eval_count ?? null,
        rawResponse: data,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        provider: this.provider,
        model,
        content: "",
        parsedContent: null,
        durationMs,
        inputTokens: null,
        outputTokens: null,
        rawResponse: {},
        success: false,
        error: errorMessage,
      };
    } finally {
      clearTimeout(timeout);
      this.abortController = null;
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }
}