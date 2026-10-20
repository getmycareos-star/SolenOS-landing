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
      `SELECT * FROM decision_memory_entries WHERE care_key = $1 ORDER BY decision_date ASC`,
      [careKey]
    );
    return result.rows.map(this.mapRowToEntry);
  }

  async add(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO decision_memory_entries (
        id, care_recipient_id, caregiver_id, care_key, decision_type, decision, decision_description,
        decision_date, recorded_date, decision_maker, decision_maker_role, decision_context,
        supporting_evidence, caregiver_concern, alternatives, expected_outcome, follow_up,
        actual_outcome, outcome_comparison, follow_up_date, related_appointment,
        related_professional_response, related_medication, related_referral, related_test,
        related_open_loop, supersedes, superseded_by, reconsidered_from, source_provenance,
        confidence, uncertainty, created_at, updated_at, version, access_scope, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35,
        $36, $37, $38, $39, $40, $41, $42, $43, $44, $45
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.id, // care_recipient_id - using id as placeholder
        entry.id, // caregiver_id - using id as placeholder
        careKey,
        entry.decision_type,
        entry.decision,
        entry.decision_description,
        entry.decision_date,
        entry.recorded_date,
        entry.decision_maker,
        entry.decision_maker_role,
        entry.decision_context,
        JSON.stringify(entry.supporting_evidence),
        entry.caregiver_concern,
        JSON.stringify(entry.alternatives),
        entry.expected_outcome,
        entry.follow_up,
        entry.actual_outcome,
        entry.outcome_comparison,
        entry.follow_up_date,
        entry.related_appointment,
        entry.related_professional_response,
        entry.related_medication,
        entry.related_referral,
        entry.related_test,
        entry.related_open_loop,
        entry.supersedes,
        entry.superseded_by,
        entry.reconsidered_from,
        entry.source_provenance,
        entry.confidence,
        entry.uncertainty,
        entry.created_at,
        entry.updated_at,
        entry.version,
        entry.access_scope,
        entry.status
      ]
    );
  }

  async update(careKey: string, entry: DecisionMemoryEntry): Promise<void> {
    await this.pool.query(
      `UPDATE decision_memory_entries SET
        decision_type = $1, decision = $2, decision_description = $3, decision_date = $4,
        recorded_date = $5, decision_maker = $6, decision_maker_role = $7, decision_context = $8,
        supporting_evidence = $9, caregiver_concern = $10, alternatives = $11, expected_outcome = $12,
        follow_up = $13, actual_outcome = $14, outcome_comparison = $15, follow_up_date = $16,
        related_appointment = $17, related_professional_response = $18, related_medication = $19,
        related_referral = $20, related_test = $21, related_open_loop = $22, supersedes = $23,
        superseded_by = $24, reconsidered_from = $25, source_provenance = $26, confidence = $27,
        uncertainty = $28, created_at = $29, updated_at = $30, version = $31, access_scope = $32,
        status = $33
      WHERE care_key = $34 AND id = $35`,
      [
        entry.decision_type,
        entry.decision,
        entry.decision_description,
        entry.decision_date,
        entry.recorded_date,
        entry.decision_maker,
        entry.decision_maker_role,
        entry.decision_context,
        JSON.stringify(entry.supporting_evidence),
        entry.caregiver_concern,
        JSON.stringify(entry.alternatives),
        entry.expected_outcome,
        entry.follow_up,
        entry.actual_outcome,
        entry.outcome_comparison,
        entry.follow_up_date,
        entry.related_appointment,
        entry.related_professional_response,
        entry.related_medication,
        entry.related_referral,
        entry.related_test,
        entry.related_open_loop,
        entry.supersedes,
        entry.superseded_by,
        entry.reconsidered_from,
        entry.source_provenance,
        entry.confidence,
        entry.uncertainty,
        entry.created_at,
        entry.updated_at,
        entry.version,
        entry.access_scope,
        entry.status,
        careKey,
        entry.id
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
      care_record_id: row.care_recipient_id as string,
      decision_type: row.decision_type as DecisionMemoryEntry["decision_type"],
      decision: row.decision as string,
      decision_description: row.decision_description as string,
      decision_date: row.decision_date as string,
      recorded_date: row.recorded_date as string,
      decision_maker: row.decision_maker as string,
      decision_maker_role: row.decision_maker_role as DecisionMemoryEntry["decision_maker_role"],
      decision_context: row.decision_context as string,
      supporting_evidence: (row.supporting_evidence as unknown as DecisionMemoryEntry["supporting_evidence"]) || [],
      caregiver_concern: row.caregiver_concern as string | null,
      alternatives: (row.alternatives as unknown as string[]) || [],
      expected_outcome: row.expected_outcome as string | null,
      follow_up: row.follow_up as string | null,
      actual_outcome: row.actual_outcome as string | null,
      outcome_comparison: row.outcome_comparison as DecisionMemoryEntry["outcome_comparison"],
      follow_up_date: row.follow_up_date as string | null,
      related_appointment: row.related_appointment as string | null,
      related_professional_response: row.related_professional_response as string | null,
      related_medication: row.related_medication as string | null,
      related_referral: row.related_referral as string | null,
      related_test: row.related_test as string | null,
      related_open_loop: row.related_open_loop as string | null,
      supersedes: row.supersedes as string | null,
      superseded_by: row.superseded_by as string | null,
      reconsidered_from: row.reconsidered_from as string | null,
      source_provenance: row.source_provenance as string,
      confidence: row.confidence as number,
      uncertainty: row.uncertainty as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      version: row.version as number,
      access_scope: row.access_scope as string,
      status: row.status as DecisionMemoryStatus,
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
    // Remove any existing entries with the same decision to avoid duplicates
    store.entries = store.entries.filter(
      existing => existing.decision !== entry.decision && existing.decision_description !== entry.decision_description
    );
    store.entries = [...store.entries, entry].slice(-24); // Keep last 24
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