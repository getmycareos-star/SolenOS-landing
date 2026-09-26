import type { Pool } from "pg";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface CareEvent {
  id: string;
  care_recipient_id: string;
  caregiver_id: string;
  event_id: string;
  event_type: string;
  situation_id: string | null;
  source: "note" | "question" | "observation" | "document" | "correction" | "decision" | "outcome" | "memory_correction";
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: string;
}

export interface CareEventStore {
  append(event: CareEvent): Promise<void>;
  getByCareRecipient(careRecipientId: string, limit?: number): Promise<CareEvent[]>;
  getBySituation(situationId: string): Promise<CareEvent[]>;
  getByCorrelation(correlationId: string): Promise<CareEvent[]>;
  getByEventId(eventId: string): Promise<CareEvent | null>;
  clear(careRecipientId?: string): Promise<void>;
  isEnabled(): boolean;
}

const memory = new Map<string, CareEvent[]>();

export function careEventCache(): Map<string, CareEvent[]> {
  return memory;
}

export class PostgresCareEventStore implements CareEventStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async append(event: CareEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO care_events (
        care_recipient_id, caregiver_id, event_id, event_type, situation_id,
        source, payload, metadata, correlation_id, causation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event.care_recipient_id,
        event.caregiver_id,
        event.event_id,
        event.event_type,
        event.situation_id,
        event.source,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata),
        event.correlation_id,
        event.causation_id,
        event.created_at,
      ]
    );
  }

  async getByCareRecipient(careRecipientId: string, limit = 100): Promise<CareEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM care_events WHERE care_recipient_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [careRecipientId, limit]
    );
    return result.rows.map(this.mapRowToEvent);
  }

  async getBySituation(situationId: string): Promise<CareEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM care_events WHERE situation_id = $1 ORDER BY created_at ASC`,
      [situationId]
    );
    return result.rows.map(this.mapRowToEvent);
  }

  async getByCorrelation(correlationId: string): Promise<CareEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM care_events WHERE correlation_id = $1 ORDER BY created_at ASC`,
      [correlationId]
    );
    return result.rows.map(this.mapRowToEvent);
  }

  async getByEventId(eventId: string): Promise<CareEvent | null> {
    const result = await this.pool.query(
      `SELECT * FROM care_events WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToEvent(result.rows[0]);
  }

  async clear(careRecipientId?: string): Promise<void> {
    if (careRecipientId) {
      await this.pool.query(
        `DELETE FROM care_events WHERE care_recipient_id = $1`,
        [careRecipientId]
      );
    } else {
      await this.pool.query(`DELETE FROM care_events`);
    }
  }

  private mapRowToEvent(row: Record<string, unknown>): CareEvent {
    return {
      id: row.id as string,
      care_recipient_id: row.care_recipient_id as string,
      caregiver_id: row.caregiver_id as string,
      event_id: row.event_id as string,
      event_type: row.event_type as string,
      situation_id: row.situation_id as string | null,
      source: row.source as CareEvent["source"],
      payload: (row.payload as unknown as Record<string, unknown>) || {},
      metadata: (row.metadata as unknown as Record<string, unknown>) || {},
      correlation_id: row.correlation_id as string | null,
      causation_id: row.causation_id as string | null,
      created_at: row.created_at as string,
    };
  }
}

export class MemoryCareEventStore implements CareEventStore {
  isEnabled(): boolean {
    return true;
  }

  async append(event: CareEvent): Promise<void> {
    const key = event.care_recipient_id;
    const events = memory.get(key) || [];
    events.unshift(event);
    if (events.length > 500) events.length = 500;
    memory.set(key, events);
  }

  async getByCareRecipient(careRecipientId: string, limit = 100): Promise<CareEvent[]> {
    const events = memory.get(careRecipientId) || [];
    return events.slice(0, limit);
  }

  async getBySituation(situationId: string): Promise<CareEvent[]> {
    const allEvents: CareEvent[] = [];
    for (const events of memory.values()) {
      allEvents.push(...events.filter(e => e.situation_id === situationId));
    }
    return allEvents.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getByCorrelation(correlationId: string): Promise<CareEvent[]> {
    const allEvents: CareEvent[] = [];
    for (const events of memory.values()) {
      allEvents.push(...events.filter(e => e.correlation_id === correlationId));
    }
    return allEvents.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getByEventId(eventId: string): Promise<CareEvent | null> {
    for (const events of memory.values()) {
      const found = events.find(e => e.event_id === eventId);
      if (found) return found;
    }
    return null;
  }

  async clear(careRecipientId?: string): Promise<void> {
    if (careRecipientId) {
      memory.delete(careRecipientId);
    } else {
      memory.clear();
    }
  }
}

let postgresStore: PostgresCareEventStore | null = null;

export async function createPostgresCareEventStore(): Promise<PostgresCareEventStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres Care Events store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresCareEventStore(pool);
  return postgresStore;
}

export function getMemoryCareEventStore(): MemoryCareEventStore {
  return new MemoryCareEventStore();
}

export async function getCareEventStore(): Promise<CareEventStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresCareEventStore();
  }
  return getMemoryCareEventStore();
}