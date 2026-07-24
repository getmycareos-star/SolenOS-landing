import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  buildGeminiExecutionEnvelope,
  GEMINI_MVP_MODEL,
  type GeminiEnvelopeOptions,
} from "../gemini-contract";
import { DEFAULT_SOLENOS_LANGUAGE, makeLanguageAwarePrompt } from "../multilingual-execution";
import type { SolenOSLanguage } from "../multilingual-execution";
import type { ContextWindowOutput } from "../context-window-strategy";
import type { DocumentIntakeOutput } from "../document-intake";
import type { GroundingContextPackage } from "../telemetry-persistence/schema";
import { extractRawLLMText } from "./raw-text";

export interface GeminiExecutionParams {
  contextWindow: ContextWindowOutput;
  documentIntake?: DocumentIntakeOutput | null;
  groundingContext?: GroundingContextPackage | null;
  envelopeOptions?: GeminiEnvelopeOptions | null;
  apiKey: string;
  model?: string;
  retry?: boolean;
  userLanguage?: SolenOSLanguage;
}

/**
 * Single-pass Gemini invocation with required execution envelope.
 * API key is passed from route.ts — never read from env in this module.
 */
export async function invokeGeminiExecution(
  params: GeminiExecutionParams,
): Promise<string> {
  const envelope = buildGeminiExecutionEnvelope(
    params.contextWindow,
    params.retry ?? false,
    params.documentIntake,
    params.envelopeOptions,
    params.groundingContext,
  );

  const userLanguage = params.userLanguage ?? DEFAULT_SOLENOS_LANGUAGE;
  const wrappedUserPrompt = makeLanguageAwarePrompt(envelope.user, userLanguage);

  const model = new ChatGoogleGenerativeAI({
    model: params.model ?? GEMINI_MVP_MODEL,
    apiKey: params.apiKey,
    temperature: 0,
    maxRetries: 0,
  });

  const response = await model.invoke([
    new SystemMessage(envelope.system),
    new HumanMessage(wrappedUserPrompt),
  ]);

  return extractRawLLMText(response.content);
}
