import type { Pool } from "pg";
import type { DecisionMemoryEntry, DecisionMemoryStatus } from "./index";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface DecisionMemoryStore {
  list(careKey: string): Promise<DecisionMemoryEntry[]>;
  add(careKey: string, entry: DecisionMemoryEntry): Promise<void>;
  update(careKey: string, entry: DecisionMemoryEntry): Promise<void>;
  delete(careKey: string, entryId: string): Promise<void>;
  clear(careKey: string): Promise<void>;
  isEnabled(): boolean;
}

const memory = new Map<string, { care_key: string; entries: DecisionMemoryEntry[]; updated_at: string }>();

export function decisionMemoryCache(): Map<string, { care_key: string; entries: DecisionMemoryEntry[]; updated_at: string }> {
  return memory;
}

export class PostgresDecisionMemoryStore implements DecisionMemoryStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async list(careKey: string): Promise<DecisionMemoryEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM decision_memory_entries WHERE care_key = $1 ORDER BY recorded_at ASC`,
      [careKey]
    );
    return result.rows.map(this.mapRowToEntry);
  }

  async add(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO decision_memory_entries (
        care_recipient_id, caregiver_id, care_key, what, decision, when_recorded,
        who, context_situation_id, context_summary, evidence, alternatives, reason,
        outcome, outcome_event_ids, status, evidence_texts, recorded_at, content_tokens
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.id,
        careKey,
        entry.what,
        entry.decision,
        entry.when,
        JSON.stringify(entry.who),
        entry.context_situation_id,
        entry.context_summary,
        JSON.stringify(entry.evidence),
        JSON.stringify(entry.alternatives),
        entry.reason,
        entry.outcome,
        JSON.stringify(entry.outcome_event_ids),
        entry.status,
        JSON.stringify(entry.evidence_texts),
        entry.recorded_at,
        JSON.stringify(entry.content_tokens),
      ]
    );
  }

  async update(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    await this.pool.query(
      `UPDATE decision_memory_entries SET
        what = $1, decision = $2, when_recorded = $3, who = $4, context_situation_id = $5,
        context_summary = $6, evidence = $7, alternatives = $8, reason = $9, outcome = $10,
        outcome_event_ids = $11, status = $12, evidence_texts = $13, recorded_at = $14,
        content_tokens = $15
      WHERE care_key = $16 AND id = $17`,
      [
        entry.what,
        entry.decision,
        entry.when,
        JSON.stringify(entry.who),
        entry.context_situation_id,
        entry.context_summary,
        JSON.stringify(entry.evidence),
        JSON.stringify(entry.alternatives),
        entry.reason,
        entry.outcome,
        JSON.stringify(entry.outcome_event_ids),
        entry.status,
        JSON.stringify(entry.evidence_texts),
        entry.recorded_at,
        JSON.stringify(entry.content_tokens),
        careKey,
        entry.id,
      ]
    );
  }

  async delete(careKey: string, entryId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM decision_memory_entries WHERE care_key = $1 AND id = $2`,
      [careKey, entryId]
    );
  }

  async clear(careKey: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM decision_memory_entries WHERE care_key = $1`,
      [careKey]
    );
  }

  private mapRowToEntry(row: Record<string, unknown>): DecisionMemoryEntry {
    return {
      id: row.id as string,
      care_key: row.care_key as string,
      what: row.what as string,
      decision: row.decision as string,
      when: row.when_recorded as string,
      who: (row.who as unknown as string[]) || [],
      context_situation_id: row.context_situation_id as string | null,
      context_summary: row.context_summary as string | null,
      evidence: (row.evidence as unknown as DecisionMemoryEntry["evidence"]) || [],
      alternatives: (row.alternatives as unknown as string[]) || [],
      reason: row.reason as string | null,
      outcome: row.outcome as string | null,
      outcome_event_ids: (row.outcome_event_ids as unknown as string[]) || [],
      status: row.status as DecisionMemoryStatus,
      evidence_texts: (row.evidence_texts as unknown as string[]) || [],
      recorded_at: row.recorded_at as string,
      content_tokens: (row.content_tokens as unknown as string[]) || [],
    };
  }
}

export class MemoryDecisionMemoryStore implements DecisionMemoryStore {
  isEnabled(): boolean {
    return true;
  }

  async list(careKey: string): Promise<DecisionMemoryEntry[]> {
    const store = memory.get(careKey);
    return store?.entries || [];
  }

  async add(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    let store = memory.get(careKey);
    if (!store) {
      store = { care_key: careKey, entries: [], updated_at: new Date().toISOString() };
      memory.set(careKey, store);
    }
    store.entries = [...store.entries.filter(e => e.what !== entry.what && e.decision !== entry.what), entry].slice(-24);
    store.updated_at = new Date().toISOString();
    writeDurableJson(
      livingCareRecordDataDir("decision-memory", `${sanitizeDurableCareKey(careKey)}.json`),
      store
    );
  }

  async update(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    let store = memory.get(careKey);
    if (!store) return;
    store.entries = store.entries.map(e => e.id === entry.id ? entry : e);
    store.updated_at = new Date().toISOString();
    writeDurableJson(
      livingCareRecordDataDir("decision-memory", `${sanitizeDurableCareKey(careKey)}.json`),
      store
    );
  }

  async delete(careKey: string, entryId: string): Promise<void> {
    let store = memory.get(careKey);
    if (!store) return;
    store.entries = store.entries.filter(e => e.id !== entryId);
    store.updated_at = new Date().toISOString();
    writeDurableJson(
      livingCareRecordDataDir("decision-memory", `${sanitizeDurableCareKey(careKey)}.json`),
      store
    );
  }

  async clear(careKey: string): Promise<void> {
    memory.delete(careKey);
    deleteDurableFile(
      livingCareRecordDataDir("decision-memory", `${sanitizeDurableCareKey(careKey)}.json`)
    );
  }
}

let postgresStore: PostgresDecisionMemoryStore | null = null;

export async function createPostgresDecisionMemoryStore(): Promise<PostgresDecisionMemoryStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres Decision Memory store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresDecisionMemoryStore(pool);
  return postgresStore;
}

export function getMemoryDecisionMemoryStore(): MemoryDecisionMemoryStore {
  return new MemoryDecisionMemoryStore();
}

export async function getDecisionMemoryStore(): Promise<DecisionMemoryStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresDecisionMemoryStore();
  }
  return getMemoryDecisionMemoryStore();
}