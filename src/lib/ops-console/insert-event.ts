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
  if (!process.env.DATABASE_URL) return null;
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

export async function insertSolenEvent(input: {
  user_id: string | null;
  event_name: string;
  session_id: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: true }> {
  const metadata = input.metadata ?? {};
  const pool = await getPool();

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
      return { success: true };
    } catch (error) {
      console.warn("[solen_events] insert failed — falling back to memory:", error);
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
  return { success: true };
}
