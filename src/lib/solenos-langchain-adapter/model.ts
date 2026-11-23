import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Qwen is the only supported model provider.
 *
 * ChatOpenAI is used here only as an OpenAI-compatible transport client for
 * the private Ollama endpoint. It does not send requests to OpenAI.
 */
export type SolenOSLLMProvider = "ollama";
export type MvpLLMProvider = "ollama";

const DEFAULT_QWEN_MODEL = "qwen3.5:4b";

export function resolveMvpLLMProvider(): MvpLLMProvider | null {
  const explicit = process.env.SOLENOS_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit && explicit !== "ollama") return null;
  if (process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim()) {
    return "ollama";
  }
  return null;
}

/** Compatibility alias for older callers; it resolves to Qwen/Ollama only. */
export function resolveSolenOSLLMProvider(): SolenOSLLMProvider | null {
  return resolveMvpLLMProvider();
}

export function createOllamaChatModel(): BaseChatModel {
  const baseURL = (
    process.env.OLLAMA_BASE_URL ??
    process.env.OLLAMA_HOST ??
    ""
  ).trim().replace(/\/$/, "");

  if (!baseURL) {
    throw new Error("Qwen is unavailable: configure the private OLLAMA_BASE_URL.");
  }

  let parsedURL: URL;
  try {
    parsedURL = new URL(baseURL);
  } catch {
    throw new Error("OLLAMA_BASE_URL must be a valid private Railway service URL.");
  }

  if (
    parsedURL.protocol !== "http:" ||
    !parsedURL.hostname.toLowerCase().endsWith(".railway.internal") ||
    parsedURL.hostname === "localhost" ||
    parsedURL.hostname === "127.0.0.1" ||
    parsedURL.hostname === "::1"
  ) {
    throw new Error("SolenOS accepts only a private Railway Ollama service URL.");
  }

  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_QWEN_MODEL;
  if (!model.toLowerCase().startsWith("qwen")) {
    throw new Error("SolenOS requires a Qwen model; other Ollama models are not supported.");
  }

  return new ChatOpenAI({
    model,
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    temperature: 0,
    maxRetries: 0,
    configuration: {
      baseURL: baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`,
    },
  });
}

/** Qwen/Ollama only. No Gemini or hosted-model fallback is permitted. */
export function createMvpChatModel(): BaseChatModel {
  if (!resolveMvpLLMProvider()) {
    throw new Error(
      "Qwen is unavailable. Configure OLLAMA_BASE_URL for the private Ollama service.",
    );
  }
  return createOllamaChatModel();
}

/** Compatibility alias for older callers; always creates the Qwen model. */
export function createSolenOSChatModel(): BaseChatModel {
  return createMvpChatModel();
}
