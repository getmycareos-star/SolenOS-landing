import type { Pool } from "pg";

import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { computeTrustStage } from "./trust-progression";
import type { ActivationEvent, ActivationUserState, TrustStage } from "./types";

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

function parseUserState(row: Record<string, unknown>): ActivationUserState {
  return {
    user_id: String(row.user_id),
    total_entries: Number(row.total_entries ?? 0),
    first_entry_at: row.first_entry_at != null ? String(row.first_entry_at) : null,
    last_entry_at: row.last_entry_at != null ? String(row.last_entry_at) : null,
    voice_entry_count: Number(row.voice_entry_count ?? 0),
    document_entry_count: Number(row.document_entry_count ?? 0),
    trust_stage: (row.trust_stage as TrustStage) ?? computeTrustStage(Number(row.total_entries ?? 0)),
    habit_hour: row.habit_hour != null ? Number(row.habit_hour) : null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function tryLoadUserStateFromPostgres(
  userId: string,
): Promise<ActivationUserState | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT user_id, total_entries, first_entry_at, last_entry_at,
              voice_entry_count, document_entry_count, trust_stage, habit_hour, updated_at
       FROM activation_user_state WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return parseUserState(row);
  } catch {
    return null;
  }
}

export async function trySaveUserStateToPostgres(state: ActivationUserState): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO activation_user_state (
         user_id, total_entries, first_entry_at, last_entry_at,
         voice_entry_count, document_entry_count, trust_stage, habit_hour, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         total_entries = EXCLUDED.total_entries,
         first_entry_at = EXCLUDED.first_entry_at,
         last_entry_at = EXCLUDED.last_entry_at,
         voice_entry_count = EXCLUDED.voice_entry_count,
         document_entry_count = EXCLUDED.document_entry_count,
         trust_stage = EXCLUDED.trust_stage,
         habit_hour = EXCLUDED.habit_hour,
         updated_at = NOW()`,
      [
        state.user_id,
        state.total_entries,
        state.first_entry_at,
        state.last_entry_at,
        state.voice_entry_count,
        state.document_entry_count,
        state.trust_stage,
        state.habit_hour,
      ],
    );
  } catch {
    // silent fallback
  }
}

export async function trySaveEventToPostgres(event: ActivationEvent): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO activation_events (id, user_id, event_type, payload, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [event.id, event.user_id, event.event_type, JSON.stringify(event.payload), event.created_at],
    );
  } catch {
    // silent fallback
  }
}

export function resetActivationPoolForTests(): void {
  poolPromise = null;
}
