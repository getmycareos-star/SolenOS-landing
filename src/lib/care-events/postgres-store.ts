import type { Pool } from "pg";

import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { deriveConfidence, deriveUncertaintyLevel, inferEventType } from "./classify";
import type { CareEventRecord, CreateCareEventInput, EventSourceRecord } from "./types";

function buildSourceMetadata(provenance: CreateCareEventInput["provenance"]): Record<string, unknown> {
  if (provenance.input_type === "text") {
    return { input_type: "text" };
  }
  if (provenance.input_type === "document") {
    return { input_type: "document", captured_at: provenance.captured_at };
  }
  return {
    input_type: "voice",
    captured_at: provenance.captured_at,
    recognition_confidence: provenance.recognition_confidence ?? null,
    transcript_uncertain: provenance.transcript_uncertain ?? false,
  };
}

function resolveSourceType(provenance: CreateCareEventInput["provenance"]): CareEventRecord["source_type"] {
  if (provenance.input_type === "voice") return "voice";
  if (provenance.input_type === "document") return "document";
  return "text";
}

export async function persistCareEventToPostgres(
  pool: Pool,
  input: CreateCareEventInput,
): Promise<{ care_event: CareEventRecord; source: EventSourceRecord }> {
  const now = new Date().toISOString();
  const content = input.content.trim();
  const provenance = input.provenance;
  const sourceType = resolveSourceType(provenance);
  const capturedAt = provenance.captured_at ?? now;
  const eventType = input.event_type ?? inferEventType(content);
  const confidence = deriveConfidence(provenance);
  const uncertaintyLevel = deriveUncertaintyLevel(provenance);
  const sourceMetadata = buildSourceMetadata(provenance);
  const eventMetadata = { ...sourceMetadata, ...(input.metadata ?? {}) };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const eventResult = await client.query<{
      id: string;
      care_record_id: string | null;
      event_type: string;
      content: string;
      occurred_at: string | null;
      created_at: string;
      source_type: string;
      confidence: number | null;
      uncertainty_level: string | null;
      created_by: string | null;
      metadata: Record<string, unknown>;
      observer_person_id: string | null;
      author_person_id: string | null;
      subject_person_id: string | null;
      provider_person_id: string | null;
      organization_id: string | null;
    }>(
      `INSERT INTO care_events (
         care_record_id, event_type, content, occurred_at,
         source_type, confidence, uncertainty_level, created_by, metadata,
         observer_person_id, author_person_id, subject_person_id,
         provider_person_id, organization_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14)
       RETURNING id, care_record_id, event_type, content, occurred_at, created_at,
                 source_type, confidence, uncertainty_level, created_by, metadata,
                 observer_person_id, author_person_id, subject_person_id,
                 provider_person_id, organization_id`,
      [
        input.care_record_id ?? null,
        eventType,
        content,
        input.occurred_at ?? null,
        sourceType,
        confidence,
        uncertaintyLevel,
        input.created_by ?? null,
        JSON.stringify(eventMetadata),
        input.observer_person_id ?? input.created_by ?? null,
        input.author_person_id ?? null,
        input.subject_person_id ?? null,
        input.provider_person_id ?? null,
        input.organization_id ?? null,
      ],
    );

    const row = eventResult.rows[0]!;

    const sourceResult = await client.query<{
      id: string;
      care_event_id: string;
      source_type: string;
      captured_at: string;
      recognition_confidence: number | null;
      transcript_uncertain: boolean;
      metadata: Record<string, unknown>;
      created_at: string;
    }>(
      `INSERT INTO event_sources (
         care_event_id, source_type, captured_at,
         recognition_confidence, transcript_uncertain, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, care_event_id, source_type, captured_at,
                 recognition_confidence, transcript_uncertain, metadata, created_at`,
      [
        row.id,
        sourceType,
        capturedAt,
        provenance.input_type === "voice" ? (provenance.recognition_confidence ?? null) : null,
        provenance.input_type === "voice" ? (provenance.transcript_uncertain ?? false) : false,
        JSON.stringify(sourceMetadata),
      ],
    );

    await client.query("COMMIT");

    const sourceRow = sourceResult.rows[0]!;
    const source: EventSourceRecord = {
      id: sourceRow.id,
      care_event_id: sourceRow.care_event_id,
      source_type: sourceRow.source_type as EventSourceRecord["source_type"],
      captured_at: sourceRow.captured_at,
      recognition_confidence: sourceRow.recognition_confidence,
      transcript_uncertain: sourceRow.transcript_uncertain,
      metadata: sourceRow.metadata,
      created_at: sourceRow.created_at,
    };

    const careEvent: CareEventRecord = {
      id: row.id,
      care_record_id: row.care_record_id,
      event_type: row.event_type as CareEventRecord["event_type"],
      content: row.content,
      occurred_at: row.occurred_at,
      created_at: row.created_at,
      source_type: row.source_type as CareEventRecord["source_type"],
      confidence: row.confidence,
      uncertainty_level: row.uncertainty_level as CareEventRecord["uncertainty_level"],
      created_by: row.created_by,
      metadata: row.metadata,
      source,
      entities: {
        observer_person_id: row.observer_person_id,
        author_person_id: row.author_person_id,
        subject_person_id: row.subject_person_id,
        provider_person_id: row.provider_person_id,
        organization_id: row.organization_id,
      },
    };

    return { care_event: careEvent, source };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPostgresPool();
  }
  return poolPromise;
}

export async function tryPersistCareEvent(
  input: CreateCareEventInput,
): Promise<CareEventRecord | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    const { care_event } = await persistCareEventToPostgres(pool, input);
    return care_event;
  } catch {
    return null;
  }
}

export function resetCareEventPoolForTests(): void {
  poolPromise = null;
}

export function rowToCareEvent(row: {
  id: string;
  care_record_id: string | null;
  event_type: string;
  content: string;
  occurred_at: string | null;
  created_at: string;
  source_type: string;
  confidence: number | null;
  uncertainty_level: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
}): CareEventRecord {
  return {
    id: row.id,
    care_record_id: row.care_record_id,
    event_type: row.event_type as CareEventRecord["event_type"],
    content: row.content,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    source_type: row.source_type as CareEventRecord["source_type"],
    confidence: row.confidence,
    uncertainty_level: row.uncertainty_level as CareEventRecord["uncertainty_level"],
    created_by: row.created_by,
    metadata: row.metadata ?? {},
    // Note: entities and source are not populated here; this is for legacy use
    entities: {
      observer_person_id: null,
      author_person_id: null,
      subject_person_id: null,
      provider_person_id: null,
      organization_id: null,
    },
    source: {
      id: "",
      care_event_id: "",
      source_type: "text",
      captured_at: "",
      recognition_confidence: null,
      transcript_uncertain: false,
      metadata: {},
      created_at: "",
    },
  };
}

export async function loadCareEventsForCaregiverFromPostgres(
  pool: Pool,
  caregiverId: string,
): Promise<CareEventRecord[]> {
  const result = await pool.query<{
    id: string;
    care_record_id: string | null;
    event_type: string;
    content: string;
    occurred_at: string | null;
    created_at: string;
    source_type: string;
    confidence: number | null;
    uncertainty_level: string | null;
    created_by: string | null;
    metadata: Record<string, unknown>;
  }>(
    `SELECT id, care_record_id, event_type, content, occurred_at, created_at,
            source_type, confidence, uncertainty_level, created_by, metadata
         FROM care_events
         WHERE created_by = $1
         ORDER BY COALESCE(occurred_at, created_at) DESC`,
    [caregiverId],
  );

  return result.rows.map(rowToCareEvent);
}

export async function tryLoadCareEventsForCaregiver(
  caregiverId: string,
): Promise<CareEventRecord[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = await getPool();
    return loadCareEventsForCaregiverFromPostgres(pool, caregiverId);
  } catch {
    return null;
  }
}

// NEW: Delete a care event and its associated event sources
export async function deleteCareEventForCaregiverFromPostgres(
  pool: Pool,
  careEventId: string,
  caregiverId: string
): Promise<void> {
  // Delete from event_sources first (due to foreign key constraint)
  await pool.query(
    `DELETE FROM event_sources WHERE care_event_id = $1`,
    [careEventId]
  );
  // Delete from care_events, ensuring it belongs to the caregiver
  await pool.query(
    `DELETE FROM care_events WHERE id = $1 AND created_by = $2`,
    [careEventId, caregiverId]
  );
}

export async function tryDeleteCareEventForCaregiver(
  careEventId: string,
  caregiverId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const pool = await getPool();
    await deleteCareEventForCaregiverFromPostgres(pool, careEventId, caregiverId);
    return true;
  } catch (error) {
    console.error('Error deleting care event:', error);
    return false;
  }
}