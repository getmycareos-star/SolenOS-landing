import type { ExtractedClaim, ExtractionRunOutput, ConsistencyGateInput } from "./types";
import { createRunId, createRawInputId } from "./ids";
import { verifySourcePointer, enforceSourcePointer, coerceEntityType } from "./source-pointer";
import { ClaimExtractionOutputSchema } from "./claim-schema";
import { postJSON } from "@/api/client";

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
      id: c.candidate_id,
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


type QwenExtractionResponse = {
  evidence_id: string;
  run_a: { claims: unknown[] };
  run_b: { claims: unknown[] };
  provider: string;
  written_to_lcr: boolean;
  review_required: boolean;
};

function toRunOutput(modelRun: { claims: unknown[] }, runId: string, input: ConsistencyGateInput, rawInputId: string): ExtractionRunOutput {
  const output = JSON.stringify({ claims: modelRun.claims });
  const claims = parseClaimsFromOutput(output, runId, input.evidence_id, rawInputId, input.raw_text);
  const parsed = ClaimExtractionOutputSchema.safeParse({ claims: modelRun.claims });
  if (!parsed.success) {
    return { run_id: runId, claims: [], raw_output: output, success: false, error: "Qwen returned claims that did not match the required format." };
  }
  return { run_id: runId, claims, raw_output: output, success: true };
}

async function requestTwoRuns(input: ConsistencyGateInput): Promise<QwenExtractionResponse> {
  // The canonical evidence writer stores trimmed source_text. Send that
  // exact persisted representation so the backend can verify identity/content.
  const response = await postJSON("/assistant/claim-extraction", {
    evidence_id: input.evidence_id,
    raw_text: input.raw_text.trim(),
  }) as QwenExtractionResponse;
  if (
    response.evidence_id !== input.evidence_id ||
    response.provider !== "private_ollama_qwen" ||
    response.written_to_lcr !== false ||
    response.review_required !== true ||
    !response.run_a || !Array.isArray(response.run_a.claims) ||
    !response.run_b || !Array.isArray(response.run_b.claims)
  ) {
    throw new Error("Qwen did not return two valid review-only extraction runs.");
  }
  return response;
}

export async function runSingleExtraction(
  input: ConsistencyGateInput,
  runLabel: "A" | "B",
  _signal?: AbortSignal,
): Promise<ExtractionRunOutput> {
  const runId = createRunId();
  try {
    const response = await requestTwoRuns(input);
    const selected = runLabel === "A" ? response.run_a : response.run_b;
    return toRunOutput(selected, runId, input, createRawInputId());
  } catch (err: unknown) {
    return { run_id: runId, claims: [], raw_output: "", success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runParallelExtractions(
  input: ConsistencyGateInput,
  _signal?: AbortSignal,
): Promise<{ runA: ExtractionRunOutput; runB: ExtractionRunOutput }> {
  const runAId = createRunId();
  const runBId = createRunId();
  const rawInputId = createRawInputId();
  try {
    const response = await requestTwoRuns(input);
    return {
      runA: toRunOutput(response.run_a, runAId, input, rawInputId),
      runB: toRunOutput(response.run_b, runBId, input, rawInputId),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      runA: { run_id: runAId, claims: [], raw_output: "", success: false, error: message },
      runB: { run_id: runBId, claims: [], raw_output: "", success: false, error: message },
    };
  }
}
