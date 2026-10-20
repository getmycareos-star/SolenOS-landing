import type { Pool } from "pg";
import type {
  StateModel,
  StateHistoryEntry,
  ChangeRecord,
  StateDomain,
} from "./types";

export async function upsertCurrentState(
  pool: Pool,
  state: StateModel,
): Promise<void> {
  await pool.query(
    `INSERT INTO care_state_current (
      person_id, domain, field, value, confidence_tag,
      source_claim_id, as_of, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (person_id, domain, field) DO UPDATE SET
      value = EXCLUDED.value,
      confidence_tag = EXCLUDED.confidence_tag,
      source_claim_id = EXCLUDED.source_claim_id,
      as_of = EXCLUDED.as_of,
      updated_at = EXCLUDED.updated_at`,
    [
      state.person_id,
      state.domain,
      state.field,
      state.value,
      state.confidence_tag,
      state.source_claim_id,
      state.as_of,
      state.updated_at,
    ],
  );
}

export async function insertStateHistory(
  pool: Pool,
  entry: StateHistoryEntry,
): Promise<void> {
  await pool.query(
    `INSERT INTO care_state_history (
      id, person_id, domain, field, value, confidence_tag,
      source_claim_id, as_of, replaced_at, change_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      entry.id,
      entry.person_id,
      entry.domain,
      entry.field,
      entry.value,
      entry.confidence_tag,
      entry.source_claim_id,
      entry.as_of,
      entry.replaced_at,
      entry.change_id,
    ],
  );
}

export async function insertChangeRecord(
  pool: Pool,
  change: ChangeRecord,
): Promise<void> {
  await pool.query(
    `INSERT INTO care_state_changes (
      id, person_id, domain, field, previous_value, new_value,
      detected_at, change_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      change.id,
      change.person_id,
      change.domain,
      change.field,
      change.previous_value ? JSON.stringify(change.previous_value) : null,
      JSON.stringify(change.new_value),
      change.detected_at,
      change.change_type,
    ],
  );
}

export async function loadCurrentState(
  pool: Pool,
  personId: string,
  domain: StateDomain,
  field: string,
): Promise<StateModel | null> {
  const result = await pool.query<{
    person_id: string;
    domain: string;
    field: string;
    value: string;
    confidence_tag: string;
    source_claim_id: string;
    as_of: string;
    updated_at: string;
  }>(
    `SELECT person_id, domain, field, value, confidence_tag,
            source_claim_id, as_of, updated_at
     FROM care_state_current
     WHERE person_id = $1 AND domain = $2 AND field = $3`,
    [personId, domain, field],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0]!;
  return {
    person_id: row.person_id,
    domain: row.domain as StateDomain,
    field: row.field,
    value: row.value,
    confidence_tag: row.confidence_tag as StateModel["confidence_tag"],
    source_claim_id: row.source_claim_id,
    as_of: row.as_of,
    updated_at: row.updated_at,
  };
}

export async function loadStateHistory(
  pool: Pool,
  personId: string,
  domain: StateDomain,
  field: string,
): Promise<StateHistoryEntry[]> {
  const result = await pool.query<{
    id: string;
    person_id: string;
    domain: string;
    field: string;
    value: string;
    confidence_tag: string;
    source_claim_id: string;
    as_of: string;
    replaced_at: string;
    change_id: string | null;
  }>(
    `SELECT id, person_id, domain, field, value, confidence_tag,
            source_claim_id, as_of, replaced_at, change_id
     FROM care_state_history
     WHERE person_id = $1 AND domain = $2 AND field = $3
     ORDER BY as_of ASC`,
    [personId, domain, field],
  );

  return result.rows.map((row) => ({
    id: row.id,
    person_id: row.person_id,
    domain: row.domain as StateDomain,
    field: row.field,
    value: row.value,
    confidence_tag: row.confidence_tag as StateHistoryEntry["confidence_tag"],
    source_claim_id: row.source_claim_id,
    as_of: row.as_of,
    replaced_at: row.replaced_at,
    change_id: row.change_id,
  }));
}

export async function loadChangeRecords(
  pool: Pool,
  personId: string,
  domain?: StateDomain,
): Promise<ChangeRecord[]> {
  let query = `SELECT id, person_id, domain, field, previous_value, new_value, detected_at, change_type
               FROM care_state_changes
               WHERE person_id = $1`;
  const params: (string | StateDomain)[] = [personId];

  if (domain) {
    query += ` AND domain = $2`;
    params.push(domain);
  }

  query += ` ORDER BY detected_at ASC`;

  const result = await pool.query<{
    id: string;
    person_id: string;
    domain: string;
    field: string;
    previous_value: string | null;
    new_value: string;
    detected_at: string;
    change_type: string;
  }>(query, params);

  return result.rows.map((row) => ({
    id: row.id,
    person_id: row.person_id,
    domain: row.domain as StateDomain,
    field: row.field,
    previous_value: row.previous_value ? JSON.parse(row.previous_value) : null,
    new_value: JSON.parse(row.new_value),
    detected_at: row.detected_at,
    change_type: row.change_type as ChangeRecord["change_type"],
  }));
}
