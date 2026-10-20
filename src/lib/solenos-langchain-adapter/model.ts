import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/** @deprecated Non-MVP OpenAI path — use gemini or ollama. */
export type SolenOSLLMProvider = "gemini" | "openai";

export type MvpLLMProvider = "gemini" | "ollama";

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OLLAMA_MODEL = "llama3.2";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export function resolveMvpLLMProvider(): MvpLLMProvider | null {
  const explicit = process.env.SOLENOS_LLM_PROVIDER?.toLowerCase();
  if (explicit === "gemini" || explicit === "ollama") {
    return explicit;
  }
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST) return "ollama";
  return null;
}

/** @deprecated Use resolveMvpLLMProvider for /api/analyze. */
export function resolveSolenOSLLMProvider(): SolenOSLLMProvider | null {
  const explicit = process.env.SOLENOS_LLM_PROVIDER?.toLowerCase();
  if (explicit === "gemini" || explicit === "openai") {
    return explicit;
  }
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function createGeminiChatModel(): BaseChatModel {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for Gemini invocation.");
  }

  return new ChatGoogleGenerativeAI({
    model: process.env.SOLENOS_LLM_MODEL ?? DEFAULT_GEMINI_MODEL,
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0,
    maxRetries: 0,
  });
}

export function createOllamaChatModel(): BaseChatModel {
  const baseURL = (
    process.env.OLLAMA_BASE_URL ??
    process.env.OLLAMA_HOST ??
    DEFAULT_OLLAMA_BASE_URL
  ).replace(/\/$/, "");

  return new ChatOpenAI({
    model: process.env.SOLENOS_LLM_MODEL ?? DEFAULT_OLLAMA_MODEL,
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    temperature: 0,
    maxRetries: 0,
    configuration: {
      baseURL: baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`,
    },
  });
}

/** MVP: Gemini or Ollama only — single pass, no retries at provider level. */
export function createMvpChatModel(): BaseChatModel {
  const provider = resolveMvpLLMProvider();
  if (!provider) {
    throw new Error(
      "No MVP LLM configured. Set GEMINI_API_KEY or OLLAMA_BASE_URL.",
    );
  }

  if (provider === "gemini") {
    return createGeminiChatModel();
  }

  return createOllamaChatModel();
}

/**
 * @deprecated Non-MVP multi-provider helper.
 */
export function createSolenOSChatModel(): BaseChatModel {
  const provider = resolveSolenOSLLMProvider();
  if (!provider) {
    throw new Error(
      "No LLM credentials configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
    );
  }

  if (provider === "gemini") {
    return createGeminiChatModel();
  }

  return new ChatOpenAI({
    model: process.env.SOLENOS_LLM_MODEL ?? "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    maxRetries: 0,
    configuration: process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : undefined,
  });
}
