import type { Pool } from "pg";

import { coerceSolenOSLanguage } from "../multilingual-execution";
import { parseSolenOSSettings } from "../settings-governance";
import type { SolenOSSettings } from "../settings-governance";
import type { TelemetryFeedbackSubmit, TelemetryInteractionInsert } from "./schema";
import type {
  TelemetryReliefEventResult,
  TelemetryStore,
  UserLanguagePreferenceUpdate,
} from "./types";
import { classifyReliefOutcomeAfterFeedback } from "../relief-validation";
import {
  POSTGRES_INTERACTION_CONTEXT_LIMIT,
  POSTGRES_KNOWLEDGE_CHUNK_LIMIT,
} from "../postgres-contract";

export class PostgresTelemetryStore implements TelemetryStore {
  constructor(private readonly pool: Pool) {}

  isEnabled(): boolean {
    return true;
  }

  async ensureUser(existingUserId?: string): Promise<{ user_id: string }> {
    if (existingUserId) {
      const existing = await this.pool.query<{ id: string }>(
        `UPDATE users SET last_seen_at = NOW() WHERE id = $1 RETURNING id`,
        [existingUserId],
      );
      if (existing.rowCount && existing.rows[0]) {
        return { user_id: existing.rows[0].id };
      }
    }

    const inserted = await this.pool.query<{ id: string }>(
      `INSERT INTO users (last_seen_at) VALUES (NOW()) RETURNING id`,
    );
    return { user_id: inserted.rows[0]!.id };
  }

  async getUserLanguagePreference(userId: string) {
    const result = await this.pool.query<{ language_preference: string }>(
      `SELECT language_preference FROM users WHERE id = $1`,
      [userId],
    );
    const value = result.rows[0]?.language_preference;
    return value ? coerceSolenOSLanguage(value) : null;
  }

  async updateUserLanguagePreference(
    userId: string,
    prefs: UserLanguagePreferenceUpdate,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET language_preference = $2,
           ui_language = $3,
           voice_language = $2,
           last_seen_at = NOW()
       WHERE id = $1`,
      [userId, prefs.language_preference, prefs.ui_language],
    );
  }

  async getUserGovernanceSettings(userId: string): Promise<SolenOSSettings | null> {
    const result = await this.pool.query<{ governance_settings: unknown }>(
      `SELECT governance_settings FROM users WHERE id = $1`,
      [userId],
    );
    const value = result.rows[0]?.governance_settings;
    if (!value || typeof value !== "object") {
      return null;
    }
    return parseSolenOSSettings(value);
  }

  async updateUserGovernanceSettings(
    userId: string,
    settings: SolenOSSettings,
  ): Promise<void> {
    const parsed = parseSolenOSSettings(settings);
    await this.pool.query(
      `UPDATE users
       SET governance_settings = $2::jsonb,
           last_seen_at = NOW()
       WHERE id = $1`,
      [userId, JSON.stringify(parsed)],
    );
  }

  async getLastInteractionInput(userId: string): Promise<string | null> {
    const result = await this.pool.query<{ input_raw: string }>(
      `SELECT input_raw FROM interactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0]?.input_raw ?? null;
  }

  async loadDocumentEvidence(userId: string) {
    const result = await this.pool.query(
      `SELECT id, user_id, file_url, extracted_text, structured_output, created_at
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      ...row,
      created_at: String(row.created_at),
    }));
  }

  async loadInteractionContext(userId: string, limit = POSTGRES_INTERACTION_CONTEXT_LIMIT) {
    const result = await this.pool.query(
      `SELECT id, input_raw, output_structured, risk_level, created_at
       FROM interactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map((row) => ({
      ...row,
      created_at: String(row.created_at),
    }));
  }

  async retrieveKnowledgeChunks(limit = POSTGRES_KNOWLEDGE_CHUNK_LIMIT) {
    const result = await this.pool.query(
      `SELECT id, chunk, category, source
       FROM knowledge_base
       ORDER BY id
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async loadPolicyFacts(categories?: readonly string[]) {
    if (categories && categories.length > 0) {
      const result = await this.pool.query(
        `SELECT id, category, key, value, last_updated
         FROM policy_facts
         WHERE category = ANY($1::text[])
         ORDER BY category, key`,
        [categories],
      );
      return result.rows.map((row) => ({
        ...row,
        last_updated: String(row.last_updated),
      }));
    }

    const result = await this.pool.query(
      `SELECT id, category, key, value, last_updated
       FROM policy_facts
       ORDER BY category, key`,
    );
    return result.rows.map((row) => ({
      ...row,
      last_updated: String(row.last_updated),
    }));
  }

  async recordReliefEvent(event: TelemetryInteractionInsert): Promise<TelemetryReliefEventResult> {
    await this.pool.query(
      `UPDATE users SET last_seen_at = NOW(), total_sessions = total_sessions + 1 WHERE id = $1`,
      [event.user_id],
    );

    const inserted = await this.pool.query<{ id: string }>(
      `INSERT INTO interactions (
        user_id, input_raw, output_structured, risk_level, latency_ms, structure_valid,
        semantic_valid, input_category, relief_outcome, requery_detected, helpful_feedback,
        relief_signal, helpful_yes_no, reduced_confusion_yes_no, care_context_state,
        caregiver_depletion_state, is_single_caregiver, environmental_dependency_flag
      ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id`,
      [
        event.user_id,
        event.input_raw,
        JSON.stringify(event.output_structured),
        event.risk_level,
        event.latency_ms,
        event.structure_valid,
        event.semantic_valid,
        event.input_category,
        event.relief_outcome,
        event.requery_detected,
        event.helpful_feedback,
        event.relief_signal ?? null,
        event.helpful_yes_no ?? null,
        event.reduced_confusion_yes_no ?? null,
        event.care_context_state,
        event.caregiver_depletion_state,
        event.is_single_caregiver,
        event.environmental_dependency_flag,
      ],
    );

    return {
      user_id: event.user_id,
      interaction_id: inserted.rows[0]!.id,
    };
  }

  async recordFeedback(feedback: TelemetryFeedbackSubmit): Promise<void> {
    const interaction = await this.pool.query<{
      requery_detected: boolean;
    }>(
      `SELECT requery_detected FROM interactions WHERE id = $1`,
      [feedback.interaction_id],
    );
    if (!interaction.rowCount || !interaction.rows[0]) {
      throw new Error("interaction not found");
    }

    const relief_outcome = classifyReliefOutcomeAfterFeedback({
      requery_detected: interaction.rows[0].requery_detected,
      clarification_detected: false,
      helpful_feedback: feedback.helpful_yes_no,
      reduced_confusion: feedback.reduced_confusion_yes_no,
    });

    await this.pool.query(
      `INSERT INTO feedback (interaction_id, helpful_yes_no, reduced_confusion_yes_no, user_id)
       SELECT $1, $2, $3, user_id FROM interactions WHERE id = $1`,
      [feedback.interaction_id, feedback.helpful_yes_no, feedback.reduced_confusion_yes_no],
    );

    await this.pool.query(
      `UPDATE interactions
       SET helpful_feedback = $2,
           relief_outcome = $3,
           helpful_yes_no = $2,
           reduced_confusion_yes_no = $4
       WHERE id = $1`,
      [
        feedback.interaction_id,
        feedback.helpful_yes_no,
        relief_outcome,
        feedback.reduced_confusion_yes_no,
      ],
    );
  }
}

export async function createPostgresPool(): Promise<Pool> {
  const { Pool: PgPool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres telemetry");
  }
  return new PgPool({ connectionString, max: 4 });
}
