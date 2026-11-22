import type { ExtractedClaim, ExtractionRunOutput, ConsistencyGateInput } from "./types";
import { createRunId, createClaimId, createRawInputId } from "./ids";
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


type QwenClaimExtractionResponse = {
  run_a: { claims: unknown[] };
  run_b: { claims: unknown[] };
  provider: "private_ollama_qwen";
  written_to_lcr: false;
  review_required: true;
};

function toRunOutput(
  modelRun: { claims: unknown[] },
  runId: string,
  evidenceId: string,
  rawInputId: string,
  originalText: string,
): ExtractionRunOutput {
  const rawOutput = JSON.stringify({ claims: modelRun.claims });
  const claims = parseClaimsFromOutput(rawOutput, runId, evidenceId, rawInputId, originalText);
  return { run_id: runId, claims, raw_output: rawOutput, success: true };
}

export async function runSingleExtraction(
  input: ConsistencyGateInput,
  runLabel: "A" | "B",
  _signal?: AbortSignal,
): Promise<ExtractionRunOutput> {
  const runId = createRunId();
  const rawInputId = createRawInputId();
  try {
    const response = await postJSON("/assistant/claim-extraction", {
      evidence_id: input.evidence_id,
      raw_text: input.raw_text,
    }) as QwenClaimExtractionResponse;
    if (response.provider !== "private_ollama_qwen" || response.written_to_lcr !== false || response.review_required !== true) {
      throw new Error("The Qwen extraction response did not meet the review-only contract.");
    }
    const selected = runLabel === "A" ? response.run_a : response.run_b;
    if (!selected || !Array.isArray(selected.claims)) {
      throw new Error("Qwen returned an invalid extraction run.");
    }
    return toRunOutput(selected, runId, input.evidence_id, rawInputId, input.raw_text);
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
  _signal?: AbortSignal,
): Promise<{ runA: ExtractionRunOutput; runB: ExtractionRunOutput }> {
  const runAId = createRunId();
  const runBId = createRunId();
  const rawInputId = createRawInputId();
  try {
    const response = await postJSON("/assistant/claim-extraction", {
      evidence_id: input.evidence_id,
      raw_text: input.raw_text,
    }) as QwenClaimExtractionResponse;
    if (response.provider !== "private_ollama_qwen" || response.written_to_lcr !== false || response.review_required !== true) {
      throw new Error("The Qwen extraction response did not meet the review-only contract.");
    }
    if (!response.run_a || !Array.isArray(response.run_a.claims) || !response.run_b || !Array.isArray(response.run_b.claims)) {
      throw new Error("Qwen did not return two independent extraction runs.");
    }
    return {
      runA: toRunOutput(response.run_a, runAId, input.evidence_id, rawInputId, input.raw_text),
      runB: toRunOutput(response.run_b, runBId, input.evidence_id, rawInputId, input.raw_text),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      runA: { run_id: runAId, claims: [], raw_output: "", success: false, error: message },
      runB: { run_id: runBId, claims: [], raw_output: "", success: false, error: message },
    };
  }
}
