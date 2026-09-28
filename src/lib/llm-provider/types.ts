/** LLM provider boundary types — model-agnostic interface for structured extraction. */

export type LlmProviderType = "ollama" | "openai" | "anthropic" | "gemini" | "qwen";

export type LlmRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRequestOptions = {
  model: string;
  messages: LlmRequestMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  format?: "json" | "json_schema" | null;
  jsonSchema?: Record<string, unknown>;
};

export type LlmResponse = {
  provider: string;
  model: string;
  content: string;
  parsedContent: unknown | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  rawResponse: Record<string, unknown>;
  success: boolean;
  error?: string;
};

export type LlmProviderConfig = {
  provider: LlmProviderType;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
};

export type LlmInvocationMetadata = {
  invocationId: string;
  provider: string;
  model: string;
  requestStart: string;
  requestDuration: number;
  success: boolean;
  validationSuccess: boolean | null;
  structuredRecordCounts: Record<string, number>;
  error?: string;
};