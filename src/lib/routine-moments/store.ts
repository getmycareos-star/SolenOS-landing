/**
 * Routine Moments Store — persistence layer for routine moment data.
 * 
 * Implements the data model defined in types.ts with Postgres persistence
 * and in-memory caching for performance.
 */

import type { Pool } from "pg";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import type {
  RoutineMomentRecord,
  RoutineMomentObservation,
  RoutineMomentChange,
  RoutineBaseline,
  RoutineMomentType,
  RoutineObservationState,
  AssistanceLevel,
  ParticipationLevel,
  RoutineFrequency,
  ConfidenceLevel,
  SourceType
} from "./types";

/**
 * Database table schema for routine moments.
 * This represents the core routine moment record.
 */
export type RoutineMomentsTable = {
  id: string;
  person_id: string;
  routine_type: string; // RoutineMomentType
  baseline_data: unknown; // Serialized RoutineBaseline
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

/**
 * Database table schema for routine moment observations.
 */
export type RoutineMomentObservationsTable = {
  id: string;
  routine_moment_id: string; // FK to routine_moments.id
  person_id: string;
  routine_type: string; // RoutineMomentType
  observation_state: string; // RoutineObservationState
  occurred_at: string;
  recorded_by: string;
  source_type: string; // SourceType
  context?: string;
  assistance_level?: string; // AssistanceLevel
  participation_level?: string; // ParticipationLevel
  duration_minutes?: number;
  raw_evidence_id?: string;
  care_event_id?: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

/**
 * Database table schema for routine moment changes.
 */
export type RoutineMomentChangesTable = {
  id: string;
  routine_moment_id: string; // FK to routine_moments.id
  person_id: string;
  routine_type: string; // RoutineMomentType
  change_description: string;
  change_type: string;
  observation_period_start: string; // ISO date
  observation_period_end: string;   // ISO date
  confidence: string; // ConfidenceLevel
  is_sustained_change: boolean;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

/**
 * Convert RoutineBaseline to JSON for storage.
 */
function routineBaselineToJSON(baseline: RoutineBaseline): unknown {
  return {
    is_established: baseline.is_established,
    pattern_description: baseline.pattern_description ?? null,
    frequency: baseline.frequency ?? null,
    typical_time_window: baseline.typical_time_window ?? null,
    typical_assistance_level: baseline.typical_assistance_level ?? null,
    typical_participation_level: baseline.typical_participation_level ?? null,
    confidence: baseline.confidence,
    evidence_ids: baseline.evidence_ids,
    baseline_period: baseline.baseline_period,
    last_updated_at: baseline.last_updated_at
  };
}

/**
 * Convert JSON to RoutineBaseline from storage.
 */
function jsonToRoutineBaseline(json: unknown): RoutineBaseline {
  const data = json as {
    is_established: boolean;
    pattern_description: string | null;
    frequency: string | null;
    typical_time_window: string | null;
    typical_assistance_level: string | null;
    typical_participation_level: string | null;
    confidence: ConfidenceLevel;
    evidence_ids: string[];
    baseline_period: { start_date: string; end_date: string };
    last_updated_at: string;
  };
  
  return {
    is_established: data.is_established,
    pattern_description: data.pattern_description,
    frequency: data.frequency as RoutineFrequency | null,
    typical_time_window: data.typical_time_window,
    typical_assistance_level: data.typical_assistance_level as AssistanceLevel | null,
    typical_participation_level: data.typical_participation_level as ParticipationLevel | null,
    confidence: data.confidence,
    evidence_ids: data.evidence_ids,
    baseline_period: data.baseline_period,
    last_updated_at: data.last_updated_at
  };
}

/**
 * Persist a routine moment record to Postgres.
 */
export async function persistRoutineMomentToPostgres(
  pool: Pool,
  routineMoment: RoutineMomentRecord
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Upsert the routine moment record
    await client.query(
      `
      INSERT INTO routine_moments (
        id, person_id, routine_type, baseline_data, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        person_id = EXCLUDED.person_id,
        routine_type = EXCLUDED.routine_type,
        baseline_data = EXCLUDED.baseline_data,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `,
      [
        routineMoment.id,
        routineMoment.person_id,
        routineMoment.routine_type,
        JSON.stringify(routineBaselineToJSON(routineMoment.baseline)),
        JSON.stringify(routineMoment.metadata),
        routineMoment.created_at,
        routineMoment.updated_at
      ]
    );
    
    // Persist observations
    for (const observation of routineMoment.observations) {
      await client.query(
        `
        INSERT INTO routine_moment_observations (
          id, routine_moment_id, person_id, routine_type, observation_state,
          occurred_at, recorded_by, source_type, context, assistance_level,
          participation_level, duration_minutes, raw_evidence_id, care_event_id,
          metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          routine_moment_id = EXCLUDED.routine_moment_id,
          person_id = EXCLUDED.person_id,
          routine_type = EXCLUDED.routine_type,
          observation_state = EXCLUDED.observation_state,
          occurred_at = EXCLUDED.occurred_at,
          recorded_by = EXCLUDED.recorded_by,
          source_type = EXCLUDED.source_type,
          context = EXCLUDED.context,
          assistance_level = EXCLUDED.assistance_level,
          participation_level = EXCLUDED.participation_level,
          duration_minutes = EXCLUDED.duration_minutes,
          raw_evidence_id = EXCLUDED.raw_evidence_id,
          care_event_id = EXCLUDED.care_event_id,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
        `,
        [
          observation.id,
          routineMoment.id,
          observation.person_id,
          observation.routine_type,
          observation.observation_state,
          observation.occurred_at,
          observation.recorded_by,
          observation.source_type,
          observation.context ?? null,
          observation.assistance_level ?? null,
          observation.participation_level ?? null,
          observation.duration_minutes ?? null,
          observation.raw_evidence_id ?? null,
          observation.care_event_id ?? null,
          JSON.stringify(observation.metadata),
          observation.created_at,
          observation.updated_at
        ]
      );
    }
    
    // Persist changes
    for (const change of routineMoment.changes) {
      await client.query(
        `
        INSERT INTO routine_moment_changes (
          id, routine_moment_id, person_id, routine_type, change_description,
          change_type, observation_period_start, observation_period_end,
          confidence, is_sustained_change, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          routine_moment_id = EXCLUDED.routine_moment_id,
          person_id = EXCLUDED.person_id,
          routine_type = EXCLUDED.routine_type,
          change_description = EXCLUDED.change_description,
          change_type = EXCLUDED.change_type,
          observation_period_start = EXCLUDED.observation_period_start,
          observation_period_end = EXCLUDED.observation_period_end,
          confidence = EXCLUDED.confidence,
          is_sustained_change = EXCLUDED.is_sustained_change,
          metadata = EXCLUDED.metadata,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
        `,
        [
          change.id,
          routineMoment.id,
          change.person_id,
          change.routine_type,
          change.change_description,
          change.change_type,
          change.observation_period_start,
          change.observation_period_end,
          change.confidence,
          change.is_sustained_change,
          JSON.stringify(change.metadata),
          change.created_at,
          change.updated_at
        ]
      );
    }
    
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a routine moment record from Postgres.
 */
export async function deleteRoutineMomentFromPostgres(
  pool: Pool,
  routineMomentId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Delete changes first (due to foreign key constraints)
    await client.query(
      `DELETE FROM routine_moment_changes WHERE routine_moment_id = $1`,
      [routineMomentId]
    );
    
    // Delete observations
    await client.query(
      `DELETE FROM routine_moment_observations WHERE routine_moment_id = $1`,
      [routineMomentId]
    );
    
    // Delete the routine moment record
    await client.query(
      `DELETE FROM routine_moments WHERE id = $1`,
      [routineMomentId]
    );
    
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * In-memory store for routine moments (process-lifetime cache).
 */
export class RoutineMomentsStore {
  private readonly memory = new Map<string, RoutineMomentRecord>();
  private readonly personIndex = new Map<string, string[]>(); // person_id -> routine_moment_ids[]
  private readonly typeIndex = new Map<string, string[]>();   // routine_type -> routine_moment_ids[]
  private readonly pool: Pool | null;
   
  constructor(options: { pool?: Pool | null } = {}) {
    this.pool = options.pool ?? null;
  }
  
  /**
   * Save a routine moment record.
   */
  async save(routineMoment: RoutineMomentRecord): Promise<void> {
    // Save to memory cache
    this.memory.set(routineMoment.id, routineMoment);
    
    // Update indices
    const personIds = this.personIndex.get(routineMoment.person_id) ?? [];
    if (!personIds.includes(routineMoment.id)) {
      personIds.push(routineMoment.id);
      this.personIndex.set(routineMoment.person_id, personIds);
    }
    
    const typeIds = this.typeIndex.get(routineMoment.routine_type) ?? [];
    if (!typeIds.includes(routineMoment.id)) {
      typeIds.push(routineMoment.id);
      this.typeIndex.set(routineMoment.routine_type, typeIds);
    }
    
    // Persist to Postgres if available
    if (this.pool) {
      try {
        await persistRoutineMomentToPostgres(this.pool, routineMoment);
      } catch (error) {
        // Log error but don't fail - memory cache remains source of truth
        console.error("Failed to persist routine moment to Postgres:", error);
      }
    }
  }
  
  /**
   * Get a routine moment by ID.
   */
  getById(id: string): RoutineMomentRecord | undefined {
    return this.memory.get(id);
  }
  
  /**
   * Get all routine moments for a person.
   */
  getForPerson(personId: string): RoutineMomentRecord[] {
    const ids = this.personIndex.get(personId) ?? [];
    return ids
      .map(id => this.memory.get(id))
      .filter((r): r is RoutineMomentRecord => r !== undefined);
  }
  
  /**
   * Get all routine moments of a specific type for a person.
   */
  getForPersonAndType(personId: string, routineType: RoutineMomentType): RoutineMomentRecord[] {
    const personMoments = this.getForPerson(personId);
    return personMoments.filter(m => m.routine_type === routineType);
  }
  
  /**
   * Get all routine moments of a specific type.
   */
  getByType(routineType: RoutineMomentType): RoutineMomentRecord[] {
    const ids = this.typeIndex.get(routineType) ?? [];
    return ids
      .map(id => this.memory.get(id))
      .filter((r): r is RoutineMomentRecord => r !== undefined);
  }
  
  /**
   * Delete a routine moment.
   */
  delete(id: string): boolean {
    const routineMoment = this.memory.get(id);
    if (!routineMoment) return false;
    
    // Remove from memory
    this.memory.delete(id);
    
    // Update person index
    const personIds = this.personIndex.get(routineMoment.person_id) ?? [];
    const personIndexWithoutId = personIds.filter(pid => pid !== id);
    if (personIndexWithoutId.length === 0) {
      this.personIndex.delete(routineMoment.person_id);
    } else {
      this.personIndex.set(routineMoment.person_id, personIndexWithoutId);
    }
    
    // Update type index
    const typeIds = this.typeIndex.get(routineMoment.routine_type) ?? [];
    const typeIndexWithoutId = typeIds.filter(tid => tid !== id);
    if (typeIndexWithoutId.length === 0) {
      this.typeIndex.delete(routineMoment.routine_type);
    } else {
      this.typeIndex.set(routineMoment.routine_type, typeIndexWithoutId);
    }
    
    // Delete from Postgres if available
    if (this.pool) {
      try {
        await deleteRoutineMomentFromPostgres(this.pool, id);
      } catch (error) {
        // Log error but don't fail - memory cache remains source of truth
        console.error("Failed to delete routine moment from Postgres:", error);
      }
    }
    
    return true;
  }
  
  /**
   * Reset the store (for testing).
   */
  reset(): void {
    this.memory.clear();
    this.personIndex.clear();
    this.typeIndex.clear();
    // TODO: Reset Postgres if needed
  }
}

/**
 * Global store instance.
 */
let globalStore: RoutineMomentsStore | null = null;

/**
 * Get the global routine moments store instance.
 */
export function getRoutineMomentsStore(): RoutineMomentsStore {
  if (!globalStore) {
    globalStore = new RoutineMomentsStore();
  }
  return globalStore;
}

/**
 * Set the global routine moments store instance.
 */
export function setRoutineMomentsStore(store: RoutineMomentsStore): void {
  globalStore = store;
}

/**
 * Reset the global routine moments store.
 */
export function resetRoutineMomentsStore(): void {
  if (globalStore) {
    globalStore.reset();
  }
}