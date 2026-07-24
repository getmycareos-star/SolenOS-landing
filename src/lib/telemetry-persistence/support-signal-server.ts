import type { SupportSignalTelemetryInsert } from "./support-signal-telemetry";
import { getTelemetryStore } from "./server";
import { createPostgresPool } from "./postgres-store";
import type { Pool } from "pg";

const memorySupportSignalEvents: SupportSignalTelemetryInsert[] = [];
let supportSignalPoolPromise: Promise<Pool> | null = null;

async function getSupportSignalPool(): Promise<Pool> {
  if (!supportSignalPoolPromise) {
    supportSignalPoolPromise = createPostgresPool();
  }
  return supportSignalPoolPromise;
}

export function resetSupportSignalTelemetryForTests(): void {
  memorySupportSignalEvents.length = 0;
  supportSignalPoolPromise = null;
}

export function getMemorySupportSignalEvents(): readonly SupportSignalTelemetryInsert[] {
  return memorySupportSignalEvents;
}

export interface RecordSupportSignalEventParams extends SupportSignalTelemetryInsert {}

export interface RecordSupportSignalEventResult {
  user_id: string;
  event_id: string;
}

/**
 * Server-only telemetry — delivery/suppression audit trail.
 * Does NOT modify interactions table or analyze pipeline behavior.
 */
export async function recordSupportSignalEvent(
  params: RecordSupportSignalEventParams,
): Promise<RecordSupportSignalEventResult | null> {
  if (process.env.SOLENOS_TELEMETRY_DISABLED === "1") {
    return null;
  }

  const store = await getTelemetryStore();
  await store.ensureUser(params.user_id);

  if (process.env.DATABASE_URL) {
    const pool = await getSupportSignalPool();
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO support_signal_events (
        user_id, notification_id, category, delivered_at, suppressed
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        params.user_id,
        params.notification_id,
        params.category,
        params.delivered_at,
        params.suppressed,
      ],
    );
    return {
      user_id: params.user_id,
      event_id: inserted.rows[0]!.id,
    };
  }

  memorySupportSignalEvents.push({ ...params });
  return {
    user_id: params.user_id,
    event_id: `memory-${memorySupportSignalEvents.length}`,
  };
}

export async function getLastDeliveredSupportSignalAt(
  userId: string,
): Promise<string | null> {
  if (process.env.DATABASE_URL) {
    const pool = await getSupportSignalPool();
    const result = await pool.query<{ delivered_at: Date | null }>(
      `SELECT delivered_at FROM support_signal_events
       WHERE user_id = $1 AND suppressed = false AND delivered_at IS NOT NULL
       ORDER BY delivered_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = result.rows[0]?.delivered_at;
    return row ? String(row) : null;
  }

  for (let i = memorySupportSignalEvents.length - 1; i >= 0; i--) {
    const event = memorySupportSignalEvents[i]!;
    if (
      event.user_id === userId &&
      !event.suppressed &&
      event.delivered_at
    ) {
      return event.delivered_at;
    }
  }
  return null;
}
