import type { Pool } from "pg";
import type { CareRecipientIdentity } from "./index";
import {
  sanitizeDurableCareKey,
  livingCareRecordDataDir,
  readDurableJson,
  writeDurableJson,
  deleteDurableFile,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export interface CareRecipientIdentityStore {
  get(careKey: string): Promise<CareRecipientIdentity | null>;
  set(careKey: string, identity: CareRecipientIdentity): Promise<void>;
  delete(careKey: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

const memory = new Map<string, CareRecipientIdentity>();

export function careRecipientIdentityCache(): Map<string, CareRecipientIdentity> {
  return memory;
}

export class PostgresCareRecipientIdentityStore implements CareRecipientIdentityStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async get(careKey: string): Promise<CareRecipientIdentity | null> {
    const result = await this.pool.query(
      `SELECT * FROM care_recipient_identities WHERE care_key = $1 LIMIT 1`,
      [careKey]
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToIdentity(result.rows[0]);
  }

  async set(careKey: string, identity: CareRecipientIdentity): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO care_recipient_identities (
        care_recipient_id, caregiver_id, care_key, display_name, relationship, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (care_recipient_id) DO UPDATE SET
        caregiver_id = EXCLUDED.caregiver_id,
        care_key = EXCLUDED.care_key,
        display_name = EXCLUDED.display_name,
        relationship = EXCLUDED.relationship,
        updated_at = EXCLUDED.updated_at`,
      [
        identity.care_key,
        identity.care_key,
        careKey,
        identity.display_name,
        identity.relationship,
        now,
      ]
    );
  }

  async delete(careKey: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM care_recipient_identities WHERE care_key = $1`,
      [careKey]
    );
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM care_recipient_identities`);
  }

  private mapRowToIdentity(row: Record<string, unknown>): CareRecipientIdentity {
    return {
      care_key: row.care_key as string,
      display_name: row.display_name as string,
      relationship: row.relationship as string | null,
      updated_at: row.updated_at as string,
    };
  }
}

export class MemoryCareRecipientIdentityStore implements CareRecipientIdentityStore {
  isEnabled(): boolean {
    return true;
  }

  async get(careKey: string): Promise<CareRecipientIdentity | null> {
    return memory.get(careKey) || null;
  }

  async set(careKey: string, identity: CareRecipientIdentity): Promise<void> {
    memory.set(careKey, identity);
    writeDurableJson(
      livingCareRecordDataDir("care-recipient-identity", `${sanitizeDurableCareKey(careKey)}.json`),
      identity
    );
  }

  async delete(careKey: string): Promise<void> {
    memory.delete(careKey);
    deleteDurableFile(
      livingCareRecordDataDir("care-recipient-identity", `${sanitizeDurableCareKey(careKey)}.json`)
    );
  }

  async clear(): Promise<void> {
    memory.clear();
    clearDurableDirectory(livingCareRecordDataDir("care-recipient-identity"));
  }
}

let postgresStore: PostgresCareRecipientIdentityStore | null = null;

export async function createPostgresCareRecipientIdentityStore(): Promise<PostgresCareRecipientIdentityStore> {
  if (postgresStore) return postgresStore;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres Care Recipient Identity store");
  }
  const pool = new Pool({ connectionString, max: 4 });
  postgresStore = new PostgresCareRecipientIdentityStore(pool);
  return postgresStore;
}

export function getMemoryCareRecipientIdentityStore(): MemoryCareRecipientIdentityStore {
  return new MemoryCareRecipientIdentityStore();
}

export async function getCareRecipientIdentityStore(): Promise<CareRecipientIdentityStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresCareRecipientIdentityStore();
  }
  return getMemoryCareRecipientIdentityStore();
}