import type { Pool } from "pg";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";

/**
 * Create the Postgres pool for routine moments.
 */
export async function createRoutineMomentsPostgresPool(): Promise<Pool> {
  return createPostgresPool();
}

/**
 * Ensure the routine moments tables exist in the database.
 * This should be called during application startup or migration.
 */
export async function ensureRoutineMomentsTables(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Create routine_moments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routine_moments (
        id VARCHAR(255) PRIMARY KEY,
        person_id VARCHAR(255) NOT NULL,
        routine_type VARCHAR(100) NOT NULL,
        baseline_data JSONB NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);
    
    // Create routine_moment_observations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routine_moment_observations (
        id VARCHAR(255) PRIMARY KEY,
        routine_moment_id VARCHAR(255) NOT NULL,
        person_id VARCHAR(255) NOT NULL,
        routine_type VARCHAR(100) NOT NULL,
        observation_state VARCHAR(50) NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
        recorded_by VARCHAR(255) NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        context TEXT,
        assistance_level VARCHAR(50),
        participation_level VARCHAR(50),
        duration_minutes INTEGER,
        raw_evidence_id VARCHAR(255),
        care_event_id VARCHAR(255),
        metadata JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        FOREIGN KEY (routine_moment_id) REFERENCES routine_moments(id) ON DELETE CASCADE
      )
    `);
    
    // Create routine_moment_changes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routine_moment_changes (
        id VARCHAR(255) PRIMARY KEY,
        routine_moment_id VARCHAR(255) NOT NULL,
        person_id VARCHAR(255) NOT NULL,
        routine_type VARCHAR(100) NOT NULL,
        change_description TEXT NOT NULL,
        change_type VARCHAR(100) NOT NULL,
        observation_period_start DATE NOT NULL,
        observation_period_end DATE NOT NULL,
        confidence VARCHAR(20) NOT NULL,
        is_sustained_change BOOLEAN NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        FOREIGN KEY (routine_moment_id) REFERENCES routine_moments(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moments_person_id 
      ON routine_moments(person_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moments_routine_type 
      ON routine_moments(routine_type)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moment_observations_person_id 
      ON routine_moment_observations(person_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moment_observations_routine_moment_id 
      ON routine_moment_observations(routine_moment_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moment_changes_person_id 
      ON routine_moment_changes(person_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_routine_moment_changes_routine_moment_id 
      ON routine_moment_changes(routine_moment_id)
    `);
  } finally {
    client.release();
  }
}

/**
 * Reset the routine moments tables (for testing).
 * WARNING: This will delete all data!
 */
export async function resetRoutineMomentsTables(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query("DROP TABLE IF EXISTS routine_moment_changes CASCADE");
    await client.query("DROP TABLE IF EXISTS routine_moment_observations CASCADE");
    await client.query("DROP TABLE IF EXISTS routine_moments CASCADE");
    
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}