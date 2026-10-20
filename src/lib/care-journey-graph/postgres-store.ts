import type { Pool } from "pg";

import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import type {
  CareJourneyGraph,
  JourneyGraphEvent,
  JourneyRelationship,
} from "./types";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

function rowToEvent(row: {
  id: string;
  journey_id: string;
  caregiver_id: string;
  case_id: string | null;
  event_type: string;
  timestamp: string;
  description: string;
  people_involved: unknown;
  location: string | null;
  evidence: unknown;
  related_event_ids: unknown;
  clinical_importance: string;
  open_questions: unknown;
  resolved_status: string;
  source: string;
  category: string;
  title: string;
  attachments: unknown;
  metadata: Record<string, unknown>;
  created_at: string;
}): JourneyGraphEvent {
  return {
    id: row.id,
    journey_id: row.journey_id,
    caregiver_id: row.caregiver_id,
    case_id: row.case_id,
    event_type: row.event_type as JourneyGraphEvent["event_type"],
    timestamp: row.timestamp,
    description: row.description,
    people_involved: parseStringArray(row.people_involved),
    location: row.location,
    evidence: (row.evidence as JourneyGraphEvent["evidence"]) ?? { source: "unknown" },
    related_event_ids: parseStringArray(row.related_event_ids),
    clinical_importance: row.clinical_importance as JourneyGraphEvent["clinical_importance"],
    open_questions: parseStringArray(row.open_questions),
    resolved_status: row.resolved_status as JourneyGraphEvent["resolved_status"],
    source: row.source,
    category: row.category,
    title: row.title,
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as JourneyGraphEvent["attachments"])
      : [],
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

function rowToRelationship(row: {
  id: string;
  journey_id: string;
  from_event_id: string;
  to_event_id: string;
  relationship_type: string;
  note: string;
  created_at: string;
}): JourneyRelationship {
  return {
    id: row.id,
    journey_id: row.journey_id,
    from_event_id: row.from_event_id,
    to_event_id: row.to_event_id,
    relationship_type: row.relationship_type as JourneyRelationship["relationship_type"],
    note: row.note,
    created_at: row.created_at,
  };
}

export async function saveGraphEventToPostgres(
  pool: Pool,
  event: JourneyGraphEvent,
  relationships: JourneyRelationship[],
): Promise<void> {
  await pool.query(
    `INSERT INTO care_journey_graph_events (
       id, journey_id, caregiver_id, case_id, event_type, timestamp, description,
       people_involved, location, evidence, related_event_ids, clinical_importance,
       open_questions, resolved_status, source, category, title, attachments, metadata
     )
     VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12,
             $13::jsonb, $14, $15, $16, $17, $18::jsonb, $19::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.journey_id,
      event.caregiver_id,
      event.case_id,
      event.event_type,
      event.timestamp,
      event.description,
      JSON.stringify(event.people_involved),
      event.location,
      JSON.stringify(event.evidence),
      JSON.stringify(event.related_event_ids),
      event.clinical_importance,
      JSON.stringify(event.open_questions),
      event.resolved_status,
      event.source,
      event.category,
      event.title,
      JSON.stringify(event.attachments),
      JSON.stringify(event.metadata),
    ],
  );

  for (const rel of relationships) {
    await pool.query(
      `INSERT INTO care_journey_graph_relationships (
         id, journey_id, from_event_id, to_event_id, relationship_type, note
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [rel.id, rel.journey_id, rel.from_event_id, rel.to_event_id, rel.relationship_type, rel.note],
    );
  }
}

export async function loadGraphFromPostgres(
  pool: Pool,
  caregiverId: string,
): Promise<CareJourneyGraph | null> {
  const eventsResult = await pool.query<{
    id: string;
    journey_id: string;
    caregiver_id: string;
    case_id: string | null;
    event_type: string;
    timestamp: string;
    description: string;
    people_involved: unknown;
    location: string | null;
    evidence: unknown;
    related_event_ids: unknown;
    clinical_importance: string;
    open_questions: unknown;
    resolved_status: string;
    source: string;
    category: string;
    title: string;
    attachments: unknown;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT id, journey_id, caregiver_id, case_id, event_type, timestamp, description,
            people_involved, location, evidence, related_event_ids, clinical_importance,
            open_questions, resolved_status, source, category, title, attachments, metadata, created_at
     FROM care_journey_graph_events
     WHERE caregiver_id = $1
     ORDER BY timestamp DESC`,
    [caregiverId],
  );

  if (eventsResult.rows.length === 0) return null;

  const journeyId = eventsResult.rows[0]!.journey_id;
  const relResult = await pool.query<{
    id: string;
    journey_id: string;
    from_event_id: string;
    to_event_id: string;
    relationship_type: string;
    note: string;
    created_at: string;
  }>(
    `SELECT id, journey_id, from_event_id, to_event_id, relationship_type, note, created_at
     FROM care_journey_graph_relationships
     WHERE journey_id = $1`,
    [journeyId],
  );

  return {
    journey_id: journeyId,
    caregiver_id: caregiverId,
    case_id: eventsResult.rows[0]!.case_id,
    events: eventsResult.rows.map(rowToEvent),
    relationships: relResult.rows.map(rowToRelationship),
    updated_at: eventsResult.rows[0]!.created_at,
  };
}

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPostgresPool();
  return poolPromise;
}

export async function trySaveGraphEvent(
  event: JourneyGraphEvent,
  relationships: JourneyRelationship[],
): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const pool = await getPool();
    await saveGraphEventToPostgres(pool, event, relationships);
    return true;
  } catch {
    return false;
  }
}

export async function tryLoadGraphForCaregiver(
  caregiverId: string,
): Promise<CareJourneyGraph | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    return loadGraphFromPostgres(pool, caregiverId);
  } catch {
    return null;
  }
}

export function resetCareJourneyGraphPoolForTests(): void {
  poolPromise = null;
}
