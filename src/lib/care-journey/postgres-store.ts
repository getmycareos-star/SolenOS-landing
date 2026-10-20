import type { Pool } from "pg";

import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import type { CareJourneyAttachment, CareJourneyEvent, CreateCareJourneyEventInput } from "./types";
import { inferCareJourneyCategory, inferCareJourneyTitle } from "./classify";

function parseAttachments(raw: unknown): CareJourneyAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is CareJourneyAttachment =>
      !!a &&
      typeof a === "object" &&
      typeof (a as CareJourneyAttachment).id === "string" &&
      typeof (a as CareJourneyAttachment).name === "string",
  );
}

function rowToEvent(row: {
  event_id: string;
  case_id: string | null;
  caregiver_id: string;
  category: string;
  title: string;
  description: string;
  event_date: string;
  source: string;
  attachments: unknown;
  metadata: Record<string, unknown>;
  created_at: string;
}): CareJourneyEvent {
  return {
    event_id: row.event_id,
    case_id: row.case_id,
    caregiver_id: row.caregiver_id,
    category: row.category as CareJourneyEvent["category"],
    title: row.title,
    description: row.description,
    event_date: row.event_date,
    source: row.source,
    attachments: parseAttachments(row.attachments),
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

export async function saveCareJourneyEventToPostgres(
  pool: Pool,
  input: CreateCareJourneyEventInput,
): Promise<CareJourneyEvent> {
  const now = new Date().toISOString();
  const description = input.description.trim();
  const category = input.category ?? inferCareJourneyCategory(description);
  const caregiverId = input.caregiver_id ?? "default_caregiver";

  const result = await pool.query<{
    event_id: string;
    case_id: string | null;
    caregiver_id: string;
    category: string;
    title: string;
    description: string;
    event_date: string;
    source: string;
    attachments: unknown;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `INSERT INTO care_journey_events (
       case_id, caregiver_id, category, title, description,
       event_date, source, attachments, metadata
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
     RETURNING event_id, case_id, caregiver_id, category, title, description,
               event_date, source, attachments, metadata, created_at`,
    [
      input.case_id ?? null,
      caregiverId,
      category,
      input.title?.trim() || inferCareJourneyTitle(description, category),
      description,
      input.event_date ?? now,
      input.source ?? "caregiver",
      JSON.stringify(input.attachments ?? []),
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  return rowToEvent(result.rows[0]!);
}

export async function loadCareJourneyEventsFromPostgres(
  pool: Pool,
  caregiverId: string,
): Promise<CareJourneyEvent[]> {
  const result = await pool.query<{
    event_id: string;
    case_id: string | null;
    caregiver_id: string;
    category: string;
    title: string;
    description: string;
    event_date: string;
    source: string;
    attachments: unknown;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT event_id, case_id, caregiver_id, category, title, description,
            event_date, source, attachments, metadata, created_at
     FROM care_journey_events
     WHERE caregiver_id = $1
     ORDER BY event_date DESC`,
    [caregiverId],
  );

  return result.rows.map(rowToEvent);
}

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

export async function trySaveCareJourneyEvent(
  input: CreateCareJourneyEventInput,
): Promise<CareJourneyEvent | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    return saveCareJourneyEventToPostgres(pool, input);
  } catch {
    return null;
  }
}

export async function tryLoadCareJourneyEvents(
  caregiverId: string,
): Promise<CareJourneyEvent[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    return loadCareJourneyEventsFromPostgres(pool, caregiverId);
  } catch {
    return null;
  }
}

export function resetCareJourneyPoolForTests(): void {
  poolPromise = null;
}
