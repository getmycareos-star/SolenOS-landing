import type { Pool } from "pg";

import { SystemEventInsertSchema, type SystemEventInsert } from "./events";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";

const memorySystemEvents: SystemEventInsert[] = [];
let eventPoolPromise: Promise<Pool> | null = null;

async function getEventPool(): Promise<Pool> {
  if (!eventPoolPromise) {
    eventPoolPromise = createPostgresPool();
  }
  return eventPoolPromise;
}

export function resetSystemEventsForTests(): void {
  memorySystemEvents.length = 0;
  eventPoolPromise = null;
}

export function getMemorySystemEvents(): readonly SystemEventInsert[] {
  return memorySystemEvents;
}

export interface EmitSystemEventResult {
  event_id: string;
  user_id: string;
}

/**
 * Append-only system event emission.
 * Inserts when DATABASE_URL is available; no-op in memory/disabled mode.
 * Failures are non-blocking — callers must not depend on event persistence.
 */
export async function emitSystemEvent(
  params: SystemEventInsert,
): Promise<EmitSystemEventResult | null> {
  if (process.env.SOLENOS_TELEMETRY_DISABLED === "1") {
    return null;
  }

  const parsed = SystemEventInsertSchema.parse(params);

  if (process.env.DATABASE_URL) {
    try {
      const pool = await getEventPool();
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO system_events (case_id, user_id, event_type, payload)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [parsed.case_id ?? null, parsed.user_id, parsed.event_type, parsed.payload],
      );
      return {
        event_id: inserted.rows[0]!.id,
        user_id: parsed.user_id,
      };
    } catch (error) {
      console.warn("[emitSystemEvent] append-only insert failed (non-blocking):", error);
      return null;
    }
  }

  memorySystemEvents.push(parsed);
  return {
    event_id: `memory-${memorySystemEvents.length}`,
    user_id: parsed.user_id,
  };
}
