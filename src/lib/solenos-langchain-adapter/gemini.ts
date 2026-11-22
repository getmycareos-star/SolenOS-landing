import type { GeminiEnvelopeOptions } from "../gemini-contract";
import type { ContextWindowOutput } from "../context-window-strategy";
import type { DocumentIntakeOutput } from "../document-intake";
import type { GroundingContextPackage } from "../telemetry-persistence/schema";

/**
 * Compatibility shape for the retired /api/analyze pipeline.
 * This function deliberately performs no model call. Caregiver inference must
 * use authenticated backend Qwen workflows; this legacy route returns HTTP 410.
 */
export interface GeminiExecutionParams {
  contextWindow: ContextWindowOutput;
  documentIntake?: DocumentIntakeOutput | null;
  groundingContext?: GroundingContextPackage | null;
  envelopeOptions?: GeminiEnvelopeOptions | null;
  /** @deprecated Ignored. No hosted provider key is accepted. */
  apiKey?: string;
  /** @deprecated Ignored. Model selection is owned by the backend. */
  model?: string;
  retry?: boolean;
  userLanguage?: string;
}

/** @deprecated Retired compatibility export; never invokes Gemini or Qwen. */
export async function invokeGeminiExecution(
  _params: GeminiExecutionParams,
): Promise<string> {
  throw new Error(
    "Legacy analysis is retired. Use the authenticated backend Qwen workflows.",
  );
}
