/**
 * Contradiction resolution engine — Qwen reasons about which reading is correct.
 *
 * Boundary: this layer proposes resolutions. It never commits them. The
 * deterministic engine and human caregiver always have the final say.
 */

import { createLlmProvider } from "../llm-provider";
import {
  isEndpointUnreachable,
  isLlmMarkedUnavailable,
  markLlmUnavailable,
} from "../llm-provider/availability-memo";
import type { LlmProvider } from "../llm-provider";
import type { ContradictionResolutionResult } from "./types";
import { createEmptyResolutionResult } from "./types";

// Advisory only: a resolution is a proposal the caregiver may reject, so it must
// never be the reason a capture takes half a minute. The caregiver's wait
// matters more than the model's second opinion.
const RESOLUTION_TIMEOUT_MS = Number(process.env.CONTRADICTION_TIMEOUT_MS ?? 8000);
const RESOLUTION_MODEL = process.env.CONTRADICTION_MODEL ?? "qwen2.5-coder:7b";

const RESOLUTION_SYSTEM = `You resolve contradictions in care information. Return ONLY a JSON object.

Rules:
- Never invent facts. Only reason about what was said.
- Weigh source reliability: a clinician's note is more reliable than a caregiver's recollection. A recent document is more reliable than an old one. A document is more reliable than oral recollection.
- Consider corroboration: does one reading have more supporting evidence?
- Consider temporal ordering: which is more recent?
- Generate hypotheses about why the contradiction exists.
- When you cannot determine which is correct, say so. Never guess.
- Never diagnose. Never give medical advice.

Return:
{
  "resolutions": [
    {
      "id": string,
      "claimA": string,
      "claimB": string,
      "field": string,
      "likelyCorrect": "a"|"b"|"neither"|"both_possible",
      "confidence": number,
      "reasoning": string,
      "hypotheses": string[],
      "resolutionPath": string,
      "sourceAssessment": {
        "a": { "sourceType": string, "reliability": number, "reasoning": string },
        "b": { "sourceType": string, "reliability": number, "reasoning": string }
      },
      "temporalOrder": "a_more_recent"|"b_more_recent"|"unknown"|"same_time",
      "corroboration": "a_supported"|"b_supported"|"both_supported"|"neither_supported",
      "needsHumanConfirmation": boolean
    }
  ],
  "unresolvedCount": number,
  "needsHumanCount": number
}`;

export type ContradictionResolutionInput = {
  contradictions: Array<{
    id: string;
    claimA: string;
    claimB: string;
    field: string;
    sourceA?: string | null;
    sourceB?: string | null;
    dateA?: string | null;
    dateB?: string | null;
  }>;
  provider?: LlmProvider;
  model?: string;
  timeoutMs?: number;
};

export async function resolveContradictions(
  input: ContradictionResolutionInput,
): Promise<ContradictionResolutionResult> {
  const start = Date.now();
  const model = input.model ?? RESOLUTION_MODEL;
  const timeoutMs = Math.max(2000, Math.min(input.timeoutMs ?? RESOLUTION_TIMEOUT_MS, 60000));

  if (input.contradictions.length === 0) {
    return { ...createEmptyResolutionResult(), durationMs: Date.now() - start };
  }

  // Contradictions are always surfaced to the caregiver regardless; only the
  // model's proposed reading is skipped while the provider is known to be down.
  if (!input.provider && isLlmMarkedUnavailable()) {
    return { ...createEmptyResolutionResult(), durationMs: Date.now() - start };
  }

  let provider = input.provider;
  if (!provider) {
    try {
      provider = await createLlmProvider({ provider: "ollama", model, timeoutMs, temperature: 0, maxTokens: 4096 });
    } catch {
      markLlmUnavailable();
      return { ...createEmptyResolutionResult(), durationMs: Date.now() - start };
    }
  }

  try {
    const response = await provider.invoke({
      model,
      messages: [
        { role: "system", content: RESOLUTION_SYSTEM },
        { role: "user", content: `CONTRADICTIONS TO RESOLVE:\n${JSON.stringify(input.contradictions, null, 2)}\n\nReturn ONLY the JSON object.` },
      ],
      temperature: 0,
      maxTokens: 4096,
      timeoutMs,
      format: "json",
    });

    if (!response.success || !response.parsedContent) {
      if (isEndpointUnreachable(response.error)) markLlmUnavailable();
      return { ...createEmptyResolutionResult(), durationMs: Date.now() - start, model };
    }

    const payload = response.parsedContent as Record<string, unknown>;
    const resolutions = Array.isArray(payload.resolutions) ? payload.resolutions : [];

    return {
      version: "1.0.0",
      resolutions: resolutions as ContradictionResolutionResult["resolutions"],
      unresolvedCount: typeof payload.unresolvedCount === "number" ? payload.unresolvedCount : resolutions.length,
      needsHumanCount: typeof payload.needsHumanCount === "number" ? payload.needsHumanCount : resolutions.length,
      source: "llm",
      degraded: false,
      model,
      durationMs: response.durationMs,
    };
  } catch (error) {
    if (isEndpointUnreachable(error)) markLlmUnavailable();
    return { ...createEmptyResolutionResult(), durationMs: Date.now() - start, model };
  }
}