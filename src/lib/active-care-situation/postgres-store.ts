import type { Pool } from "pg";
import type { ActiveCareSituation } from "./types";
import type { ProgressiveUnderstandingEffect } from "../progressive-understanding/contract-constants";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface ActiveCareSituationStore {
  get(careRecipientId: string): Promise<ActiveCareSituation | null>;
  set(careRecipientId: string, situation: ActiveCareSituation): Promise<void>;
  delete(careRecipientId: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

const GLOBAL_KEY = "__solenos_acs_cache__";

type GlobalAcs = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ActiveCareSituation>;
};

export function acsCache(): Map<string, ActiveCareSituation> {
  const g = globalThis as GlobalAcs;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, ActiveCareSituation>();
  }
  return g[GLOBAL_KEY]!;
}

export class PostgresActiveCareSituationStore implements ActiveCareSituationStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<ActiveCareSituation | null> {
    const result = await this.pool.query(
      `SELECT * FROM active_care_situations WHERE care_recipient_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [careRecipientId]
    );
    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    return this.mapRowToSituation(row);
  }

  async set(careRecipientId: string, situation: ActiveCareSituation): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO active_care_situations (
        care_recipient_id, caregiver_id, situation_id, root_event_id, subject_label,
        theme, understanding_stage, lifecycle_status, interaction_paused_at,
        last_understanding_effect, last_understanding_delta, pattern_label,
        familiarity_baseline, compound_signal, trajectory_by_domain,
        cross_signal_correlations, observations, open_questions, asked_questions,
        connection_note, synthesis, what_matters_now,
        opened_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (situation_id) DO UPDATE SET
        care_recipient_id = EXCLUDED.care_recipient_id,
        caregiver_id = EXCLUDED.caregiver_id,
        root_event_id = EXCLUDED.root_event_id,
        subject_label = EXCLUDED.subject_label,
        theme = EXCLUDED.theme,
        understanding_stage = EXCLUDED.understanding_stage,
        lifecycle_status = EXCLUDED.lifecycle_status,
        interaction_paused_at = EXCLUDED.interaction_paused_at,
        last_understanding_effect = EXCLUDED.last_understanding_effect,
        last_understanding_delta = EXCLUDED.last_understanding_delta,
        pattern_label = EXCLUDED.pattern_label,
        familiarity_baseline = EXCLUDED.familiarity_baseline,
        compound_signal = EXCLUDED.compound_signal,
        trajectory_by_domain = EXCLUDED.trajectory_by_domain,
        cross_signal_correlations = EXCLUDED.cross_signal_correlations,
        observations = EXCLUDED.observations,
        open_questions = EXCLUDED.open_questions,
        asked_questions = EXCLUDED.asked_questions,
        connection_note = EXCLUDED.connection_note,
        synthesis = EXCLUDED.synthesis,
        what_matters_now = EXCLUDED.what_matters_now,
        updated_at = EXCLUDED.updated_at`,
      [
        situation.care_recipient_id || careRecipientId,
        situation.caregiver_id,
        situation.id,
        situation.root_event_id,
        situation.subject_label,
        situation.theme,
        situation.understanding_stage,
        situation.lifecycle_status,
        situation.interaction_paused_at,
        situation.last_understanding_effect,
        situation.last_understanding_delta,
        situation.pattern_label,
        JSON.stringify(situation.familiarity_baseline || []),
        situation.compound_signal,
        JSON.stringify(situation.trajectory_by_domain || {}),
        JSON.stringify(situation.cross_signal_correlations || []),
        JSON.stringify(situation.observations),
        JSON.stringify(situation.open_questions || []),
        JSON.stringify(situation.asked_questions || []),
        situation.connection_note,
        situation.synthesis,
        situation.what_matters_now,
        situation.opened_at,
        now,
      ]
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM active_care_situations WHERE care_recipient_id = $1`,
      [careRecipientId]
    );
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM active_care_situations`);
  }

  private mapRowToSituation(row: Record<string, unknown>): ActiveCareSituation {
    return {
      id: row.situation_id as string,
      care_recipient_id: row.care_recipient_id as string,
      caregiver_id: row.caregiver_id as string,
      opened_at: row.opened_at as string,
      updated_at: row.updated_at as string,
      root_event_id: row.root_event_id as string | null,
      subject_label: row.subject_label as string,
      theme: row.theme as ActiveCareSituation["theme"],
      observations: (row.observations as unknown as ActiveCareSituation["observations"]) || [],
      open_questions: (row.open_questions as unknown as string[]) || [],
      asked_questions: (row.asked_questions as unknown as string[]) || [],
      understanding_stage: row.understanding_stage as ActiveCareSituation["understanding_stage"],
      connection_note: row.connection_note as string | null,
      synthesis: row.synthesis as string | null,
      what_matters_now: row.what_matters_now as string | null,
      interaction_paused_at: row.interaction_paused_at as string | null,
      lifecycle_status: row.lifecycle_status as ActiveCareSituation["lifecycle_status"],
      last_understanding_effect: row.last_understanding_effect as ProgressiveUnderstandingEffect | null,
      last_understanding_delta: row.last_understanding_delta as string | null,
      pattern_label: row.pattern_label as string | null,
      familiarity_baseline: (row.familiarity_baseline as unknown as string[]) || [],
      compound_signal: row.compound_signal as string | null,
      trajectory_by_domain: (row.trajectory_by_domain as unknown as Record<string, "worsening" | "improving" | "stable" | "unknown">) || {},
      cross_signal_correlations: (row.cross_signal_correlations as unknown as Array<{
        signal_a: string;
        signal_b: string;
        correlation: "correlated" | "inverse" | "independent" | "unknown";
      }>) || [],
    };
  }
}

export class MemoryActiveCareSituationStore implements ActiveCareSituationStore {
  private memory = new Map<string, ActiveCareSituation>();

  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<ActiveCareSituation | null> {
    return this.memory.get(careRecipientId) || null;
  }

  async set(careRecipientId: string, situation: ActiveCareSituation): Promise<void> {
    this.memory.set(careRecipientId, situation);
    const key = situation.care_recipient_id || situation.caregiver_id;
    writeDurableJson(
      livingCareRecordDataDir("active-care-situation", `${sanitizeDurableCareKey(key)}.json`),
      situation
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    this.memory.delete(careRecipientId);
    deleteDurableFile(
      livingCareRecordDataDir("active-care-situation", `${sanitizeDurableCareKey(careRecipientId)}.json`)
    );
  }

  async clear(): Promise<void> {
    this.memory.clear();
    clearDurableDirectory(livingCareRecordDataDir("active-care-situation"));
  }
}

let postgresStore: PostgresActiveCareSituationStore | null = null;

export async function createPostgresActiveCareSituationStore(): Promise<PostgresActiveCareSituationStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres ACS store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresActiveCareSituationStore(pool);
  return postgresStore;
}

export function getMemoryActiveCareSituationStore(): MemoryActiveCareSituationStore {
  return new MemoryActiveCareSituationStore();
}

export async function getActiveCareSituationStore(): Promise<ActiveCareSituationStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresActiveCareSituationStore();
  }
  return getMemoryActiveCareSituationStore();
}