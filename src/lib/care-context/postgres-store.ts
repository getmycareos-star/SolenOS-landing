import type { Pool } from "pg";
import type { CareContext } from "./types";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface CareContextStore {
  get(careRecipientId: string): Promise<CareContext | null>;
  set(careRecipientId: string, context: CareContext): Promise<void>;
  delete(careRecipientId: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

const memory = new Map<string, CareContext>();

export function careContextCache(): Map<string, CareContext> {
  return memory;
}

export class PostgresCareContextStore implements CareContextStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<CareContext | null> {
    const result = await this.pool.query(
      `SELECT * FROM care_contexts WHERE care_recipient_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [careRecipientId]
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToContext(result.rows[0]);
  }

  async set(careRecipientId: string, context: CareContext): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO care_contexts (
        care_recipient_id, caregiver_id, identity, timeline, recent_changes,
        uncertainties, prioritized_actions, state_of_care, caregiver_load, patterns, oml, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (care_recipient_id) DO UPDATE SET
        caregiver_id = EXCLUDED.caregiver_id,
        identity = EXCLUDED.identity,
        timeline = EXCLUDED.timeline,
        recent_changes = EXCLUDED.recent_changes,
        uncertainties = EXCLUDED.uncertainties,
        prioritized_actions = EXCLUDED.prioritized_actions,
        state_of_care = EXCLUDED.state_of_care,
        caregiver_load = EXCLUDED.caregiver_load,
        patterns = EXCLUDED.patterns,
        oml = EXCLUDED.oml,
        updated_at = EXCLUDED.updated_at`,
      [
        careRecipientId,
        (context as any).caregiver_id || "",
        JSON.stringify(context.identity || {}),
        JSON.stringify(context.timeline),
        JSON.stringify(context.recentChanges),
        JSON.stringify(context.uncertainties),
        JSON.stringify(context.prioritizedActions),
        JSON.stringify(context.stateOfCare || {}),
        JSON.stringify(context.caregiverLoad || {}),
        JSON.stringify(context.patterns),
        JSON.stringify(context.oml || {}),
        now,
      ]
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM care_contexts WHERE care_recipient_id = $1`,
      [careRecipientId]
    );
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM care_contexts`);
  }

  private mapRowToContext(row: Record<string, unknown>): CareContext {
    return {
      identity: (row.identity as unknown as CareContext["identity"]) || {},
      timeline: (row.timeline as unknown as CareContext["timeline"]) || [],
      recentChanges: (row.recent_changes as unknown as CareContext["recentChanges"]) || [],
      uncertainties: (row.uncertainties as unknown as string[]) || [],
      prioritizedActions: (row.prioritized_actions as unknown as CareContext["prioritizedActions"]) || [],
      stateOfCare: (row.state_of_care as unknown as CareContext["stateOfCare"]) || undefined,
      caregiverLoad: (row.caregiver_load as unknown as CareContext["caregiverLoad"]) || undefined,
      patterns: (row.patterns as unknown as CareContext["patterns"]) || [],
      oml: (row.oml as unknown as CareContext["oml"]) || undefined,
      updatedAt: row.updated_at as string,
    };
  }
}

export class MemoryCareContextStore implements CareContextStore {
  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<CareContext | null> {
    return memory.get(careRecipientId) || null;
  }

  async set(careRecipientId: string, context: CareContext): Promise<void> {
    const withUpdatedAt = { ...context, updatedAt: new Date().toISOString() };
    memory.set(careRecipientId, withUpdatedAt);
    writeDurableJson(
      livingCareRecordDataDir("care-context", `${sanitizeDurableCareKey(careRecipientId)}.json`),
      withUpdatedAt
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    memory.delete(careRecipientId);
    deleteDurableFile(
      livingCareRecordDataDir("care-context", `${sanitizeDurableCareKey(careRecipientId)}.json`)
    );
  }

  async clear(): Promise<void> {
    memory.clear();
    clearDurableDirectory(livingCareRecordDataDir("care-context"));
  }
}

let postgresStore: PostgresCareContextStore | null = null;

export async function createPostgresCareContextStore(): Promise<PostgresCareContextStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres Care Context store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresCareContextStore(pool);
  return postgresStore;
}

export function getMemoryCareContextStore(): MemoryCareContextStore {
  return new MemoryCareContextStore();
}

export async function getCareContextStore(): Promise<CareContextStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresCareContextStore();
  }
  return getMemoryCareContextStore();
}