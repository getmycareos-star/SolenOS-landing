import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { createPostgresPool } from "../../telemetry-persistence/postgres-store";
import type {
  CaregiverSelfProfileData,
  CaregiverSelfProfileRecord,
  CapacityLevel,
  ResolvedItemRecord,
} from "../types";

function parseProfile(raw: unknown): CaregiverSelfProfileData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Persisted caregiver profile is invalid; refusing to replace it with an empty profile.");
  }
  const obj = raw as Record<string, unknown>;
  const arrayFields = [
    "known_conditions",
    "current_medications",
    "key_dates",
    "care_team",
    "tagged_event_log",
    "open_item_descriptions",
  ];
  if (typeof obj.caregiver_basics !== "string" || arrayFields.some((field) => !Array.isArray(obj[field]))) {
    throw new Error("Persisted caregiver profile is incomplete; refusing to silently substitute empty fields.");
  }
  if (
    (obj.known_conditions as unknown[]).some((value) => typeof value !== "string") ||
    (obj.current_medications as unknown[]).some((value) => typeof value !== "string") ||
    (obj.open_item_descriptions as unknown[]).some((value) => typeof value !== "string")
  ) {
    throw new Error("Persisted caregiver profile contains invalid field values.");
  }
  return {
    caregiver_basics: obj.caregiver_basics,
    known_conditions: obj.known_conditions as string[],
    current_medications: obj.current_medications as string[],
    key_dates: obj.key_dates as CaregiverSelfProfileData["key_dates"],
    care_team: obj.care_team as CaregiverSelfProfileData["care_team"],
    tagged_event_log: obj.tagged_event_log as CaregiverSelfProfileData["tagged_event_log"],
    open_item_descriptions: obj.open_item_descriptions as string[],
  };
}

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

export async function tryLoadCaregiverSelfProfile(
  caregiverId: string,
): Promise<CaregiverSelfProfileRecord | null> {
  if (!process.env.DATABASE_URL) throw new Error("Caregiver profile database is unavailable: DATABASE_URL is not configured.");
  try {
    const pool = await getPool();
    const result = await pool.query<{
      id: string;
      caregiver_id: string;
      profile: unknown;
      session_capacity: string | null;
      resolved_items: unknown;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, caregiver_id, profile, session_capacity, resolved_items, created_at, updated_at
       FROM caregiver_self_profiles WHERE caregiver_id = $1 LIMIT 1`,
      [caregiverId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      caregiver_id: row.caregiver_id,
      profile: parseProfile(row.profile),
      session_capacity: row.session_capacity as CapacityLevel | null,
      resolved_items: Array.isArray(row.resolved_items)
        ? (row.resolved_items as ResolvedItemRecord[])
        : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch {
    throw new Error("Unable to load caregiver profile from Postgres; in-memory fallback is prohibited.");
  }
}

export async function trySaveCaregiverSelfProfile(
  record: CaregiverSelfProfileRecord,
): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("Caregiver profile database is unavailable: DATABASE_URL is not configured.");
  try {
    const pool = await getPool();
    const id = record.id.startsWith("csp_") ? randomUUID() : record.id;
    await pool.query(
      `INSERT INTO caregiver_self_profiles (id, caregiver_id, profile, session_capacity, resolved_items, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, NOW())
       ON CONFLICT (caregiver_id) DO UPDATE SET
         profile = EXCLUDED.profile,
         session_capacity = EXCLUDED.session_capacity,
         resolved_items = EXCLUDED.resolved_items,
         updated_at = NOW()`,
      [
        id,
        record.caregiver_id,
        JSON.stringify(record.profile),
        record.session_capacity,
        JSON.stringify(record.resolved_items),
      ],
    );
  } catch {
    throw new Error("Unable to persist caregiver profile to Postgres; save was not confirmed.");
  }
}

export function resetCapacitySelfPoolForTests(): void {
  poolPromise = null;
}
