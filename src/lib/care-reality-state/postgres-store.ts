import type { Pool } from "pg";
import type { CareRealityState } from "./types";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface CareRealityStateStore {
  get(careRecipientId: string): Promise<CareRealityState | null>;
  set(careRecipientId: string, state: CareRealityState): Promise<void>;
  delete(careRecipientId: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

const memory = new Map<string, CareRealityState>();

export function crsCache(): Map<string, CareRealityState> {
  return memory;
}

export class PostgresCareRealityStateStore implements CareRealityStateStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<CareRealityState | null> {
    const result = await this.pool.query(
      `SELECT * FROM care_reality_states WHERE care_recipient_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [careRecipientId]
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToState(result.rows[0]);
  }

  async set(careRecipientId: string, state: CareRealityState): Promise<void> {
    await this.pool.query(
      `INSERT INTO care_reality_states (
        care_recipient_id, caregiver_id, care_recipient_label, situation_id, root_event_id,
        understanding_stage, disclosure_stage, current_understanding, supporting_evidence,
        situation_summary, pattern_label, what_matters_now, open_uncertainties,
        resolved_uncertainties, what_changed_in_understanding, understanding_effect,
        response_evolution, primary_screen_question, observation_count, revision,
        continuity_hooks, understanding_revisions, care_domain_trajectories,
        compound_signals, change_classifications, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      ON CONFLICT (care_recipient_id) DO UPDATE SET
        caregiver_id = EXCLUDED.caregiver_id,
        care_recipient_label = EXCLUDED.care_recipient_label,
        situation_id = EXCLUDED.situation_id,
        root_event_id = EXCLUDED.root_event_id,
        understanding_stage = EXCLUDED.understanding_stage,
        disclosure_stage = EXCLUDED.disclosure_stage,
        current_understanding = EXCLUDED.current_understanding,
        supporting_evidence = EXCLUDED.supporting_evidence,
        situation_summary = EXCLUDED.situation_summary,
        pattern_label = EXCLUDED.pattern_label,
        what_matters_now = EXCLUDED.what_matters_now,
        open_uncertainties = EXCLUDED.open_uncertainties,
        resolved_uncertainties = EXCLUDED.resolved_uncertainties,
        what_changed_in_understanding = EXCLUDED.what_changed_in_understanding,
        understanding_effect = EXCLUDED.understanding_effect,
        response_evolution = EXCLUDED.response_evolution,
        primary_screen_question = EXCLUDED.primary_screen_question,
        observation_count = EXCLUDED.observation_count,
        revision = EXCLUDED.revision,
        continuity_hooks = EXCLUDED.continuity_hooks,
        understanding_revisions = EXCLUDED.understanding_revisions,
        care_domain_trajectories = EXCLUDED.care_domain_trajectories,
        compound_signals = EXCLUDED.compound_signals,
        change_classifications = EXCLUDED.change_classifications,
        updated_at = EXCLUDED.updated_at`,
      [
        state.care_recipient_id || careRecipientId,
        state.caregiver_id,
        state.care_recipient_label,
        state.situation_id,
        state.root_event_id,
        state.understanding_stage,
        state.disclosure_stage,
        JSON.stringify(state.current_understanding),
        JSON.stringify(state.supporting_evidence),
        state.situation_summary,
        state.pattern_label,
        state.what_matters_now,
        JSON.stringify(state.open_uncertainties),
        JSON.stringify(state.resolved_uncertainties),
        state.what_changed_in_understanding,
        state.understanding_effect,
        JSON.stringify(state.response_evolution),
        state.primary_screen_question,
        state.observation_count,
        state.revision,
        JSON.stringify(state.continuity_hooks),
        JSON.stringify(state.understanding_revisions),
        JSON.stringify(state.care_domain_trajectories),
        JSON.stringify(state.compound_signals),
        JSON.stringify(state.change_classifications),
        new Date().toISOString(),
      ]
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM care_reality_states WHERE care_recipient_id = $1`,
      [careRecipientId]
    );
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM care_reality_states`);
  }

  private mapRowToState(row: Record<string, unknown>): CareRealityState {
    return {
      id: row.id as string,
      care_recipient_id: row.care_recipient_id as string,
      caregiver_id: row.caregiver_id as string,
      care_recipient_label: row.care_recipient_label as string,
      updated_at: row.updated_at as string,
      situation_id: row.situation_id as string | null,
      root_event_id: row.root_event_id as string | null,
      understanding_stage: row.understanding_stage as CareRealityState["understanding_stage"],
      disclosure_stage: row.disclosure_stage as CareRealityState["disclosure_stage"],
      current_understanding: (row.current_understanding as unknown as string[]) || [],
      supporting_evidence: (row.supporting_evidence as unknown as CareRealityState["supporting_evidence"]) || [],
      situation_summary: row.situation_summary as string | null,
      pattern_label: row.pattern_label as string | null,
      what_matters_now: row.what_matters_now as string | null,
      open_uncertainties: (row.open_uncertainties as unknown as string[]) || [],
      resolved_uncertainties: (row.resolved_uncertainties as unknown as string[]) || [],
      what_changed_in_understanding: row.what_changed_in_understanding as string | null,
      understanding_effect: row.understanding_effect as CareRealityState["understanding_effect"],
      response_evolution: (row.response_evolution as unknown as CareRealityState["response_evolution"]) || {},
      primary_screen_question: row.primary_screen_question as string,
      observation_count: row.observation_count as number,
      revision: row.revision as number,
      continuity_hooks: (row.continuity_hooks as unknown as string[]) || [],
      understanding_revisions: (row.understanding_revisions as unknown as CareRealityState["understanding_revisions"]) || [],
      care_domain_trajectories: (row.care_domain_trajectories as unknown as Record<string, "worsening" | "improving" | "stable" | "unknown">) || {},
      compound_signals: (row.compound_signals as unknown as string[]) || [],
      change_classifications: (row.change_classifications as unknown as string[]) || [],
    };
  }
}

export class MemoryCareRealityStateStore implements CareRealityStateStore {
  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<CareRealityState | null> {
    return memory.get(careRecipientId) || null;
  }

  async set(careRecipientId: string, state: CareRealityState): Promise<void> {
    memory.set(careRecipientId, state);
    const key = state.care_recipient_id || state.caregiver_id;
    writeDurableJson(
      livingCareRecordDataDir("care-reality-state", `${sanitizeDurableCareKey(key)}.json`),
      state
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    memory.delete(careRecipientId);
    deleteDurableFile(
      livingCareRecordDataDir("care-reality-state", `${sanitizeDurableCareKey(careRecipientId)}.json`)
    );
  }

  async clear(): Promise<void> {
    memory.clear();
    clearDurableDirectory(livingCareRecordDataDir("care-reality-state"));
  }
}

let postgresStore: PostgresCareRealityStateStore | null = null;

export async function createPostgresCareRealityStateStore(): Promise<PostgresCareRealityStateStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres CRS store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresCareRealityStateStore(pool);
  return postgresStore;
}

export function getMemoryCareRealityStateStore(): MemoryCareRealityStateStore {
  return new MemoryCareRealityStateStore();
}

export async function getCareRealityStateStore(): Promise<CareRealityStateStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresCareRealityStateStore();
  }
  return getMemoryCareRealityStateStore();
}