/**
 * LLM Phrasing Layer — converts ChangeRecord into plain language.
 *
 * This layer runs AFTER the deterministic diff engine has produced a ChangeRecord.
 * The LLM must not:
 * - modify the ChangeRecord
 * - decide whether something changed
 * - infer causality
 * - add medical interpretation
 * - invent dates or information
 *
 * Its only job: convert structured change data into one plain-language sentence.
 */

import type { ChangeRecord } from "./types";
import type { ConfidenceTag } from "../claim-consistency/types";

const PHRASING_SYSTEM_PROMPT = `You are a neutral evidence-to-language converter for a care documentation system.

Your ONLY job is to convert structured care-state change data into ONE concise plain-language sentence.

RULES:
- Use EXACTLY the data provided. Do not add, infer, or interpret.
- Preserve the confidence qualifier (reported, inferred, confirmed, unknown) when relevant.
- Do not diagnose, treat, or suggest medical conclusions.
- Do not add dates not present in the data.
- Do not add causality ("because", "due to", "as a result").
- Do not combine multiple changes into one sentence.
- Output ONLY the sentence. No markdown. No explanation.`;

const CONFIDENCE_PHRASING: Record<ConfidenceTag, string> = {
  confirmed: "was confirmed to",
  reported: "was reported to",
  inferred: "appears to have",
  unknown: "has unknown status for",
  contradictory: "has contradictory information about",
};

export type PhraseChangeInput = {
  field: string;
  previous_value: { value: string; as_of: string } | null;
  new_value: { value: string; as_of: string };
  confidence_tag: ConfidenceTag;
  change_type: "new" | "changed" | "backfilled";
};

export type PhraseChangeResult = {
  sentence: string;
  success: boolean;
  error?: string;
};

/**
 * Deterministic fallback phrasing — used when LLM is unavailable or fails.
 */
export function deterministicPhrase(input: PhraseChangeInput): string {
  const field = input.field.replace(/_/g, " ");
  const confidence = CONFIDENCE_PHRASING[input.confidence_tag] ?? "has unknown status for";

  switch (input.change_type) {
    case "new":
      return `${field} ${confidence} be ${input.new_value.value} as of ${input.new_value.as_of}.`;

    case "changed":
      if (input.previous_value) {
        return `${field} ${confidence} change from ${input.previous_value.value} to ${input.new_value.value} as of ${input.new_value.as_of}.`;
      }
      return `${field} ${confidence} be ${input.new_value.value} as of ${input.new_value.as_of}.`;

    case "backfilled":
      return `Historical record shows ${field} was ${input.new_value.value} as of ${input.new_value.as_of} (backfilled).`;

    default:
      return `${field} updated to ${input.new_value.value}.`;
  }
}

/**
 * Optional LLM phrasing — converts a ChangeRecord into plain language.
 *
 * This function is intentionally isolated. It cannot modify the ChangeRecord.
 * If the LLM fails or is unavailable, the deterministic fallback is used.
 */
export async function phraseChangeRecord(
  record: ChangeRecord,
  options: { apiKey?: string; model?: string } = {},
): Promise<PhraseChangeResult> {
  const input: PhraseChangeInput = {
    field: record.field,
    previous_value: record.previous_value
      ? { value: record.previous_value.value, as_of: record.previous_value.as_of }
      : null,
    new_value: { value: record.new_value.value, as_of: record.new_value.as_of },
    confidence_tag: record.new_value.confidence_tag,
    change_type: record.change_type,
  };

  if (!options.apiKey) {
    return {
      sentence: deterministicPhrase(input),
      success: true,
    };
  }

  try {
    const apiKey = options.apiKey;
    const model = options.model ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            { text: JSON.stringify(input, null, 2) },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: PHRASING_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        sentence: deterministicPhrase(input),
        success: false,
        error: `LLM API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      return {
        sentence: deterministicPhrase(input),
        success: false,
        error: "Empty response from LLM",
      };
    }

    return {
      sentence: content,
      success: true,
    };
  } catch (err) {
    return {
      sentence: deterministicPhrase(input),
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
