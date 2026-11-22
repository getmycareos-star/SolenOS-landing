import { randomUUID } from "node:crypto";
import type { ExtractedClaim, ExtractionRunOutput, ConsistencyGateInput } from "./types";
import { createRunId, createClaimId, createEvidenceId, createRawInputId } from "./ids";
import { verifySourcePointer, enforceSourcePointer, coerceEntityType } from "./source-pointer";
import { ClaimExtractionOutputSchema, CLAIM_EXTRACTION_SYSTEM_PROMPT } from "./claim-schema";

const GEMINI_MODEL = "gemini-2.0-flash";

async function callGeminiForClaims(rawText: string, signal?: AbortSignal): Promise<{ output: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { output: "", error: "GEMINI_API_KEY not configured" };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: rawText },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        { text: CLAIM_EXTRACTION_SYSTEM_PROMPT },
      ],
    },
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    return { output: "", error: `Gemini API error ${response.status}: ${text.slice(0, 200)}` };
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text ?? "";

  return { output: content };
}

function parseClaimsFromOutput(
  output: string,
  runId: string,
  evidenceId: string,
  rawInputId: string,
  originalText: string,
): ExtractedClaim[] {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  const validation = ClaimExtractionOutputSchema.safeParse(parsed);
  if (!validation.success) return [];

  const claims: ExtractedClaim[] = [];

  for (const c of validation.data.claims) {
    const rawClaim: ExtractedClaim = {
      id: createClaimId(),
      claim_text: c.claim_text,
      entity_type: coerceEntityType(c.entity_type),
      event_type: c.event_type,
      confidence_tag: c.confidence_tag,
      source_span: c.source_span,
      raw_input_id: rawInputId,
      evidence_id: evidenceId,
      extraction_run_id: runId,
      created_at: new Date().toISOString(),
    };

    const verified = verifySourcePointer(rawClaim, originalText);
    const enforced = enforceSourcePointer(rawClaim, originalText);

    claims.push({
      ...enforced,
      source_span: verified ? enforced.source_span : null,
    });
  }

  return claims;
}

export async function runSingleExtraction(
  input: ConsistencyGateInput,
  runLabel: "A" | "B",
  signal?: AbortSignal,
): Promise<ExtractionRunOutput> {
  const runId = createRunId();
  const evidenceId = input.evidence_id;
  const rawInputId = createRawInputId();

  try {
    const { output, error } = await callGeminiForClaims(input.raw_text, signal);

    if (error || !output) {
      return {
        run_id: runId,
        claims: [],
        raw_output: output,
        success: false,
        error: error ?? "Empty response from model",
      };
    }

    const claims = parseClaimsFromOutput(output, runId, evidenceId, rawInputId, input.raw_text);

    return {
      run_id: runId,
      claims,
      raw_output: output,
      success: true,
    };
  } catch (err: unknown) {
    return {
      run_id: runId,
      claims: [],
      raw_output: "",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runParallelExtractions(
  input: ConsistencyGateInput,
  signal?: AbortSignal,
): Promise<{ runA: ExtractionRunOutput; runB: ExtractionRunOutput }> {
  const [runA, runB] = await Promise.all([
    runSingleExtraction(input, "A", signal),
    runSingleExtraction(input, "B", signal),
  ]);

  return { runA, runB };
}
