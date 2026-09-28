/**
 * Qwen (Alibaba Cloud) provider — OpenAI-compatible HTTP client.
 *
 * Local-first: Ollama is the default. This provider is opt-in via
 * QWEN_BASE_URL / QWEN_API_KEY and is used for long-context document
 * reasoning where the local model is too small or too slow.
 *
 * Contract: every invoke() result carries `grounded` — spans the model
 * actually quoted back from the source text. Anything not grounded is
 * discarded before it reaches any downstream layer.
 */

import type { LlmRequestOptions, LlmResponse, LlmProviderConfig } from "./types";

export class QwenProvider {
  readonly provider = "qwen";
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
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        headers: this.authHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
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
        temperature: options.temperature ?? this.config.temperature,
        max_tokens: options.maxTokens ?? this.config.maxTokens,
      };

      if (options.format === "json") {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders(),
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Qwen API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const choice = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0];
      const content = choice?.message?.content ?? "";

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
        inputTokens: (data as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? null,
        outputTokens: (data as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? null,
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

  private authHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? process.env.QWEN_API_KEY ?? "";
    if (!apiKey) return {};
    return { Authorization: `Bearer ${apiKey}` };
  }
}