import type { SolenOSLanguage } from "../multilingual-execution";
import type { SolenOSSettings } from "../settings-governance";
import type {
  DocumentEvidenceRow,
  GroundingContextPackage,
  InteractionContextRow,
  KnowledgeChunkRow,
  PolicyFactRow,
  TelemetryFeedbackSubmit,
  TelemetryInteractionInsert,
} from "./schema";

export interface UserLanguagePreferenceUpdate {
  language_preference: SolenOSLanguage;
  ui_language: SolenOSLanguage;
}

export interface UserGovernanceSettingsUpdate {
  governance_settings: SolenOSSettings;
}

export interface TelemetryReliefEventResult {
  user_id: string;
  interaction_id: string;
}

export interface TelemetryStore {
  ensureUser(existingUserId?: string): Promise<{ user_id: string }>;
  getUserLanguagePreference(userId: string): Promise<SolenOSLanguage | null>;
  updateUserLanguagePreference(
    userId: string,
    prefs: UserLanguagePreferenceUpdate,
  ): Promise<void>;
  getUserGovernanceSettings(userId: string): Promise<SolenOSSettings | null>;
  updateUserGovernanceSettings(
    userId: string,
    settings: SolenOSSettings,
  ): Promise<void>;
  getLastInteractionInput(userId: string): Promise<string | null>;
  recordReliefEvent(event: TelemetryInteractionInsert): Promise<TelemetryReliefEventResult>;
  recordFeedback(feedback: TelemetryFeedbackSubmit): Promise<void>;
  loadDocumentEvidence(userId: string): Promise<readonly DocumentEvidenceRow[]>;
  loadInteractionContext(
    userId: string,
    limit?: number,
  ): Promise<readonly InteractionContextRow[]>;
  retrieveKnowledgeChunks(limit?: number): Promise<readonly KnowledgeChunkRow[]>;
  loadPolicyFacts(categories?: readonly string[]): Promise<readonly PolicyFactRow[]>;
  isEnabled(): boolean;
}

export type { GroundingContextPackage };
