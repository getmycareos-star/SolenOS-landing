import type { Pool } from "pg";

/**
 * Low-level Postgres pool factory.
 * Kept independent of application settings/validation modules so persistence
 * adapters can be imported and tested without loading unrelated UI governance code.
 */
export async function createPostgresPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for durable Postgres storage.");
  }
  const { Pool: PgPool } = await import("pg");
  return new PgPool({ connectionString, max: 4 });
}
