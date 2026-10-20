import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildSolenOSPrompt } from "./prompt";
import {
  createSolenOSChatModel,
  createGeminiChatModel,
  createMvpChatModel,
  resolveSolenOSLLMProvider,
  resolveMvpLLMProvider,
} from "./model";
import { SOLENOS_SYSTEM_PROMPT } from "./system-prompt";
import { extractRawLLMText } from "./raw-text";
import { DEFAULT_SOLENOS_LANGUAGE, makeLanguageAwarePrompt } from "../multilingual-execution";
import type { SolenOSLanguage } from "../multilingual-execution/types";

export { extractRawLLMText } from "./raw-text";
export { invokeGeminiExecution } from "./gemini";
export type { GeminiExecutionParams } from "./gemini";

async function invokeSolenOSPrompt(
  userPrompt: string,
  userLanguage: SolenOSLanguage = DEFAULT_SOLENOS_LANGUAGE,
): Promise<string> {
  const model = createMvpChatModel();
  const wrappedPrompt = makeLanguageAwarePrompt(userPrompt, userLanguage);
  const response = await model.invoke([
    new SystemMessage(SOLENOS_SYSTEM_PROMPT),
    new HumanMessage(wrappedPrompt),
  ]);
  return extractRawLLMText(response.content);
}

/** @deprecated Use invokeGeminiExecution with apiKey from route.ts */
export async function runSolenOSMvpLLM(
  input: string,
  extraUserContent?: string,
): Promise<string> {
  let userPrompt = buildSolenOSPrompt(input);
  if (extraUserContent) {
    userPrompt += `\n\n${extraUserContent}`;
  }
  return invokeSolenOSPrompt(userPrompt);
}

/** @deprecated */
export async function runSolenOSGeminiLLM(
  input: string,
  extraUserContent?: string,
): Promise<string> {
  return runSolenOSMvpLLM(input, extraUserContent);
}

/** @deprecated Non-MVP helper */
export async function runSolenOSLLM(
  input: string,
  context?: any,
  userLanguage: SolenOSLanguage = DEFAULT_SOLENOS_LANGUAGE,
): Promise<string> {
  const userPrompt = buildSolenOSPrompt(input, context);
  const wrappedPrompt = makeLanguageAwarePrompt(userPrompt, userLanguage);
  const model = createSolenOSChatModel();
  const response = await model.invoke([
    new SystemMessage(SOLENOS_SYSTEM_PROMPT),
    new HumanMessage(wrappedPrompt),
  ]);
  return extractRawLLMText(response.content);
}

export { buildSolenOSPrompt } from "./prompt";
export {
  SOLENOS_SYSTEM_PROMPT,
  SOLENOS_SCHEMA_FIELD_NAMES,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "./system-prompt";
export {
  createSolenOSChatModel,
  createGeminiChatModel,
  createOllamaChatModel,
  createMvpChatModel,
  resolveSolenOSLLMProvider,
  resolveMvpLLMProvider,
} from "./model";
export type { SolenOSLLMProvider, MvpLLMProvider } from "./model";
