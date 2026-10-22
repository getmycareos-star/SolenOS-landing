/**
 * Server-side insert into solen_events. No business logic.
 */

import type { Pool } from "pg";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";

export type SolenEventRow = {
  id: number;
  user_id: string | null;
  event_name: string;
  timestamp: string;
  session_id: string;
  metadata: Record<string, unknown>;
};

const memoryEvents: SolenEventRow[] = [];
let poolPromise: Promise<Pool> | null = null;
let idCounter = 1;

async function getPool(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

export function getMemorySolenEvents(): readonly SolenEventRow[] {
  return memoryEvents;
}

export function resetSolenEventsMemoryForTests(): void {
  memoryEvents.length = 0;
  idCounter = 1;
  poolPromise = null;
}

export type SolenEventPersistenceStatus = "server_persisted" | "memory_only";

export async function insertSolenEvent(input: {
  user_id: string | null;
  event_name: string;
  session_id: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: true; persistence_status: SolenEventPersistenceStatus }> {
  const metadata = input.metadata ?? {};
  let pool: Pool | null = null;
  try {
    pool = await getPool();
  } catch {
    // Telemetry is non-blocking; the explicit result below records memory-only status.
  }

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO solen_events (user_id, event_name, session_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          input.user_id,
          input.event_name,
          input.session_id,
          JSON.stringify(metadata),
        ],
      );
      return { success: true, persistence_status: "server_persisted" };
    } catch {
      // Preserve non-blocking telemetry, but never represent the event as durable.
    }
  }

  memoryEvents.push({
    id: idCounter++,
    user_id: input.user_id,
    event_name: input.event_name,
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
    metadata,
  });
  return { success: true, persistence_status: "memory_only" };
}
