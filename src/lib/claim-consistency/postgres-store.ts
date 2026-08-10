import type { Pool } from "pg";
import type { ExtractedClaim } from "./types";

export async function persistReconciledClaims(
  pool: Pool,
  claims: ExtractedClaim[],
  runAId: string,
  runBId: string,
): Promise<void> {
  if (claims.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const claim of claims) {
      await client.query(
        `INSERT INTO extracted_claims (
          id, evidence_id, raw_input_id, claim_text, entity_type, event_type,
          confidence_tag, source_span_start, source_span_end, source_span_text,
          run_a_id, run_b_id, reconciled_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          confidence_tag = EXCLUDED.confidence_tag,
          reconciled_at = EXCLUDED.reconciled_at`,
        [
          claim.id,
          claim.evidence_id,
          claim.raw_input_id,
          claim.claim_text,
          claim.entity_type,
          claim.event_type,
          claim.confidence_tag,
          claim.source_span?.start_offset ?? null,
          claim.source_span?.end_offset ?? null,
          claim.source_span?.text ?? null,
          runAId,
          runBId,
          new Date().toISOString(),
          claim.created_at,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadReconciledClaimsForEvidence(
  pool: Pool,
  evidenceId: string,
): Promise<ExtractedClaim[]> {
  const result = await pool.query<{
    id: string;
    evidence_id: string;
    raw_input_id: string;
    claim_text: string;
    entity_type: string;
    event_type: string;
    confidence_tag: string;
    source_span_start: number | null;
    source_span_end: number | null;
    source_span_text: string | null;
    run_a_id: string;
    run_b_id: string;
    reconciled_at: string;
    created_at: string;
  }>(
    `SELECT id, evidence_id, raw_input_id, claim_text, entity_type, event_type,
            confidence_tag, source_span_start, source_span_end, source_span_text,
            run_a_id, run_b_id, reconciled_at, created_at
     FROM extracted_claims
     WHERE evidence_id = $1
     ORDER BY reconciled_at DESC`,
    [evidenceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    evidence_id: row.evidence_id,
    raw_input_id: row.raw_input_id,
    claim_text: row.claim_text,
    entity_type: row.entity_type as ExtractedClaim["entity_type"],
    event_type: row.event_type,
    confidence_tag: row.confidence_tag as ExtractedClaim["confidence_tag"],
    source_span: row.source_span_start !== null && row.source_span_end !== null && row.source_span_text !== null
      ? { start_offset: row.source_span_start, end_offset: row.source_span_end, text: row.source_span_text }
      : null,
    extraction_run_id: row.run_a_id,
    created_at: row.created_at,
  }));
}
