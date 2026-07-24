import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { createPostgresPool } from "../../telemetry-persistence/postgres-store";
import type { CareContextType } from "../../care-contexts/types";
import { parseDementiaContext } from "../../care-contexts/dementia/validate";
import { DEFAULT_PROFILE, type CareRecipientProfileData, type CareRecipientProfileRecord } from "../types";
import { createProfileId } from "./store";

function parseProfileData(raw: unknown): CareRecipientProfileData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROFILE };
  const obj = raw as Record<string, unknown>;
  return {
    care_recipient_basics: typeof obj.care_recipient_basics === "string" ? obj.care_recipient_basics : "",
    known_conditions: Array.isArray(obj.known_conditions)
      ? obj.known_conditions.filter((x): x is string => typeof x === "string")
      : [],
    current_medications: Array.isArray(obj.current_medications)
      ? obj.current_medications.filter((x): x is string => typeof x === "string")
      : [],
    key_dates: Array.isArray(obj.key_dates) ? (obj.key_dates as CareRecipientProfileData["key_dates"]) : [],
    care_team: Array.isArray(obj.care_team) ? (obj.care_team as CareRecipientProfileData["care_team"]) : [],
    tagged_event_log: Array.isArray(obj.tagged_event_log)
      ? (obj.tagged_event_log as CareRecipientProfileData["tagged_event_log"])
      : [],
    location_index: Array.isArray(obj.location_index)
      ? (obj.location_index as CareRecipientProfileData["location_index"])
      : [],
  };
}

export async function loadProfileFromPostgres(
  pool: Pool,
  caregiverId: string,
  caseId: string | null,
): Promise<CareRecipientProfileRecord | null> {
  const result = await pool.query<{
    id: string;
    case_id: string | null;
    caregiver_id: string;
    profile: unknown;
    care_context: string;
    dementia_context: unknown;
    last_checkin_at: string | null;
    checkin_period: string | null;
    optional_budget: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, case_id, caregiver_id, profile, care_context, dementia_context,
            last_checkin_at, checkin_period, optional_budget, created_at, updated_at
     FROM care_recipient_profiles
     WHERE caregiver_id = $1
     LIMIT 1`,
    [caregiverId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const careContext = row.care_context as CareContextType;

  return {
    id: row.id,
    case_id: row.case_id,
    caregiver_id: row.caregiver_id,
    profile: parseProfileData(row.profile),
    care_context: careContext === "dementia" || careContext === "future_condition" ? careContext : "general",
    dementia_context:
      careContext === "dementia" && row.dementia_context != null
        ? parseDementiaContext(row.dementia_context)
        : null,
    last_checkin_at: row.last_checkin_at,
    checkin_period: row.checkin_period as CareRecipientProfileRecord["checkin_period"],
    optional_budget: row.optional_budget != null ? Number(row.optional_budget) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function saveProfileToPostgres(
  pool: Pool,
  record: CareRecipientProfileRecord,
): Promise<CareRecipientProfileRecord> {
  const id = record.id.startsWith("crp_") ? randomUUID() : record.id;
  const result = await pool.query<{
    id: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO care_recipient_profiles (
       id, case_id, caregiver_id, profile, care_context, dementia_context,
       last_checkin_at, checkin_period, optional_budget, updated_at
     )
     VALUES ($1, $2::uuid, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, NOW())
     ON CONFLICT (caregiver_id)
     DO UPDATE SET
       profile = EXCLUDED.profile,
       care_context = EXCLUDED.care_context,
       dementia_context = EXCLUDED.dementia_context,
       last_checkin_at = EXCLUDED.last_checkin_at,
       checkin_period = EXCLUDED.checkin_period,
       optional_budget = EXCLUDED.optional_budget,
       updated_at = NOW()
     RETURNING id, created_at, updated_at`,
    [
      id,
      record.case_id,
      record.caregiver_id,
      JSON.stringify(record.profile),
      record.care_context,
      record.dementia_context ? JSON.stringify(record.dementia_context) : null,
      record.last_checkin_at,
      record.checkin_period,
      record.optional_budget,
    ],
  );

  const row = result.rows[0]!;
  return { ...record, id: row.id, created_at: row.created_at, updated_at: row.updated_at };
}

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

export async function tryLoadProfile(
  caregiverId: string,
  caseId: string | null,
): Promise<CareRecipientProfileRecord | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    return loadProfileFromPostgres(pool, caregiverId, caseId);
  } catch {
    return null;
  }
}

export async function trySaveProfile(record: CareRecipientProfileRecord): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const pool = await getPool();
    await saveProfileToPostgres(pool, record);
  } catch {
    // silent fallback to in-memory
  }
}

export function resetCognitiveReliefPoolForTests(): void {
  poolPromise = null;
}

export async function createProfileInPostgres(
  caregiverId: string,
  caseId: string | null,
): Promise<CareRecipientProfileRecord> {
  const now = new Date().toISOString();
  const record: CareRecipientProfileRecord = {
    id: createProfileId(),
    case_id: caseId,
    caregiver_id: caregiverId,
    profile: { ...DEFAULT_PROFILE },
    care_context: "general",
    dementia_context: null,
    last_checkin_at: null,
    checkin_period: null,
    optional_budget: null,
    created_at: now,
    updated_at: now,
  };
  if (!process.env.DATABASE_URL) return record;
  const pool = await getPool();
  return saveProfileToPostgres(pool, record);
}
