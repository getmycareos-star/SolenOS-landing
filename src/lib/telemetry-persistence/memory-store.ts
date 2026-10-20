import { randomUUID } from "node:crypto";

import { DEFAULT_SOLENOS_LANGUAGE } from "../multilingual-execution";
import type { SolenOSLanguage } from "../multilingual-execution";
import { parseSolenOSSettings } from "../settings-governance";
import type { SolenOSSettings } from "../settings-governance";
import type { TelemetryFeedbackSubmit, TelemetryInteractionInsert } from "./schema";
import type {
  TelemetryReliefEventResult,
  TelemetryStore,
  UserLanguagePreferenceUpdate,
} from "./types";
import {
  classifyReliefOutcomeAfterFeedback,
  type ReliefOutcome,
} from "../relief-validation";
import {
  POSTGRES_INTERACTION_CONTEXT_LIMIT,
  POSTGRES_KNOWLEDGE_CHUNK_LIMIT,
} from "../postgres-contract";

interface MemoryUser {
  id: string;
  created_at: string;
  last_seen_at: string;
  total_sessions: number;
  auth_enabled: boolean;
  email: string | null;
  password_hash: string | null;
  language_preference: SolenOSLanguage;
  ui_language: SolenOSLanguage;
  voice_language: SolenOSLanguage;
  governance_settings: SolenOSSettings | null;
}

interface MemoryDocument {
  id: string;
  user_id: string;
  file_url: string;
  extracted_text: string | null;
  structured_output: unknown | null;
  created_at: string;
}

interface MemoryInteraction {
  id: string;
  user_id: string;
  input_raw: string;
  output_structured: TelemetryInteractionInsert["output_structured"];
  risk_level: TelemetryInteractionInsert["risk_level"];
  latency_ms: number;
  structure_valid: boolean;
  semantic_valid: boolean;
  input_category: TelemetryInteractionInsert["input_category"];
  relief_outcome: ReliefOutcome;
  requery_detected: boolean;
  helpful_feedback: boolean | null;
  relief_signal: number | null;
  helpful_yes_no: boolean | null;
  reduced_confusion_yes_no: boolean | null;
  care_context_state: TelemetryInteractionInsert["care_context_state"];
  caregiver_depletion_state: TelemetryInteractionInsert["caregiver_depletion_state"];
  is_single_caregiver: TelemetryInteractionInsert["is_single_caregiver"];
  environmental_dependency_flag: TelemetryInteractionInsert["environmental_dependency_flag"];
  created_at: string;
}

interface MemoryFeedback {
  id: string;
  interaction_id: string;
  helpful_yes_no: boolean;
  reduced_confusion_yes_no: boolean;
  created_at: string;
}

interface MemoryKnowledgeChunk {
  id: string;
  chunk: string;
  category: string | null;
  source: string | null;
}

interface MemoryPolicyFact {
  id: string;
  category: string;
  key: string;
  value: unknown;
  last_updated: string;
}

/** Dev/test fallback — same shape as Postgres evidence ledger, not a product surface. */
export class MemoryTelemetryStore implements TelemetryStore {
  private users = new Map<string, MemoryUser>();
  private documents: MemoryDocument[] = [];
  private interactions: MemoryInteraction[] = [];
  private feedback: MemoryFeedback[] = [];
  private knowledgeChunks: MemoryKnowledgeChunk[] = [];
  private policyFacts: MemoryPolicyFact[] = [];

  isEnabled(): boolean {
    return true;
  }

  async ensureUser(existingUserId?: string): Promise<{ user_id: string }> {
    const now = new Date().toISOString();
    if (existingUserId && this.users.has(existingUserId)) {
      const user = this.users.get(existingUserId)!;
      user.last_seen_at = now;
      return { user_id: user.id };
    }

    const id = existingUserId ?? randomUUID();
    this.users.set(id, {
      id,
      created_at: now,
      last_seen_at: now,
      total_sessions: 0,
      auth_enabled: false,
      email: null,
      password_hash: null,
      language_preference: DEFAULT_SOLENOS_LANGUAGE,
      ui_language: DEFAULT_SOLENOS_LANGUAGE,
      voice_language: DEFAULT_SOLENOS_LANGUAGE,
      governance_settings: null,
    });
    return { user_id: id };
  }

  async getUserLanguagePreference(userId: string) {
    const user = this.users.get(userId);
    return user?.language_preference ?? null;
  }

  async updateUserLanguagePreference(
    userId: string,
    prefs: UserLanguagePreferenceUpdate,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.language_preference = prefs.language_preference;
    user.ui_language = prefs.ui_language;
    user.voice_language = prefs.language_preference;
    user.last_seen_at = new Date().toISOString();
  }

  async getUserGovernanceSettings(userId: string): Promise<SolenOSSettings | null> {
    const user = this.users.get(userId);
    return user?.governance_settings ?? null;
  }

  async updateUserGovernanceSettings(
    userId: string,
    settings: SolenOSSettings,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.governance_settings = parseSolenOSSettings(settings);
    user.last_seen_at = new Date().toISOString();
  }

  async getLastInteractionInput(userId: string): Promise<string | null> {
    const last = [...this.interactions]
      .filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return last?.input_raw ?? null;
  }

  async loadDocumentEvidence(userId: string) {
    return [...this.documents]
      .filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async loadInteractionContext(userId: string, limit = POSTGRES_INTERACTION_CONTEXT_LIMIT) {
    return [...this.interactions]
      .filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        input_raw: row.input_raw,
        output_structured: row.output_structured,
        risk_level: row.risk_level,
        created_at: row.created_at,
      }));
  }

  async retrieveKnowledgeChunks(limit = POSTGRES_KNOWLEDGE_CHUNK_LIMIT) {
    return this.knowledgeChunks.slice(0, limit);
  }

  async loadPolicyFacts(categories?: readonly string[]) {
    const rows = categories?.length
      ? this.policyFacts.filter((row) => categories.includes(row.category))
      : this.policyFacts;
    return [...rows].sort((a, b) =>
      a.category === b.category ? a.key.localeCompare(b.key) : a.category.localeCompare(b.category),
    );
  }

  async recordReliefEvent(event: TelemetryInteractionInsert): Promise<TelemetryReliefEventResult> {
    const user = this.users.get(event.user_id);
    if (!user) {
      throw new Error("telemetry user not found");
    }

    user.total_sessions += 1;
    user.last_seen_at = new Date().toISOString();

    const interaction_id = randomUUID();
    this.interactions.push({
      id: interaction_id,
      user_id: event.user_id,
      input_raw: event.input_raw,
      output_structured: event.output_structured,
      risk_level: event.risk_level,
      latency_ms: event.latency_ms,
      structure_valid: event.structure_valid,
      semantic_valid: event.semantic_valid,
      input_category: event.input_category,
      relief_outcome: event.relief_outcome,
      requery_detected: event.requery_detected,
      helpful_feedback: event.helpful_feedback,
      relief_signal: event.relief_signal ?? null,
      helpful_yes_no: event.helpful_yes_no ?? null,
      reduced_confusion_yes_no: event.reduced_confusion_yes_no ?? null,
      care_context_state: event.care_context_state,
      caregiver_depletion_state: event.caregiver_depletion_state,
      is_single_caregiver: event.is_single_caregiver,
      environmental_dependency_flag: event.environmental_dependency_flag,
      created_at: new Date().toISOString(),
    });

    return { user_id: event.user_id, interaction_id };
  }

  async recordFeedback(feedback: TelemetryFeedbackSubmit): Promise<void> {
    const interaction = this.interactions.find((row) => row.id === feedback.interaction_id);
    if (!interaction) {
      throw new Error("interaction not found");
    }

    this.feedback.push({
      id: randomUUID(),
      interaction_id: feedback.interaction_id,
      helpful_yes_no: feedback.helpful_yes_no,
      reduced_confusion_yes_no: feedback.reduced_confusion_yes_no,
      created_at: new Date().toISOString(),
    });

    interaction.helpful_feedback = feedback.helpful_yes_no;
    interaction.helpful_yes_no = feedback.helpful_yes_no;
    interaction.reduced_confusion_yes_no = feedback.reduced_confusion_yes_no;
    interaction.relief_outcome = classifyReliefOutcomeAfterFeedback({
      requery_detected: interaction.requery_detected,
      clarification_detected: false,
      helpful_feedback: feedback.helpful_yes_no,
      reduced_confusion: feedback.reduced_confusion_yes_no,
    });
  }

  peekUsers(): readonly MemoryUser[] {
    return [...this.users.values()];
  }

  peekInteractions(): readonly MemoryInteraction[] {
    return this.interactions;
  }

  peekFeedback(): readonly MemoryFeedback[] {
    return this.feedback;
  }

  clear(): void {
    this.users.clear();
    this.documents = [];
    this.interactions = [];
    this.feedback = [];
    this.knowledgeChunks = [];
    this.policyFacts = [];
  }
}

let singleton: MemoryTelemetryStore | null = null;

export function getMemoryTelemetryStore(): MemoryTelemetryStore {
  if (!singleton) {
    singleton = new MemoryTelemetryStore();
  }
  return singleton;
}

export function resetMemoryTelemetryStore(): void {
  singleton?.clear();
  singleton = null;
}
