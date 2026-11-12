/**
 * Interaction telemetry persistence contract. This is not the application-wide persistence architecture;
 * the backend PostgreSQL care-domain schema owns the Living Care Record.
 */

import {
  POSTGRES_CONTRACT_ONE_LINE_TRUTH,
  POSTGRES_FORBIDDEN_USES,
} from "../postgres-contract";

export const TELEMETRY_IDENTITY =
  "an interaction telemetry subsystem that measures product behavior without becoming the authority for care facts or longitudinal care history";

export const TELEMETRY_ONE_LINE_TRUTH = POSTGRES_CONTRACT_ONE_LINE_TRUTH;

export const TELEMETRY_ARCHITECTURE_PRINCIPLE =
  "Telemetry persistence measures interactions and feedback only. It must never replace, overwrite, or define the authoritative Living Care Record.";

export const TELEMETRY_POSTGRES_ROLE =
  "an isolated interaction and feedback store, separate from authoritative care-domain persistence";

export const TELEMETRY_FORBIDDEN_POSTGRES_USES = [
  ...POSTGRES_FORBIDDEN_USES,
  "user modeling",
  "memory system",
  "care journey tracking",
  "conversation_history",
] as const;

export const TELEMETRY_FORBIDDEN_IDENTITY_DRIFT = [
  "healthcare system",
  "CRM",
  "care coordination platform",
  "patient management system",
  "longitudinal tracking system",
  "personalization engine",
  "assistant with memory",
] as const;

export const TELEMETRY_USER_REQUIRED_FIELDS = [
  "id",
  "created_at",
  "last_seen_at",
  "total_sessions",
  "auth_enabled",
] as const;

export const TELEMETRY_USER_OPTIONAL_FIELDS = [
  "email",
  "password_hash",
  "language_preference",
  "ui_language",
  "voice_language",
  "governance_settings",
] as const;

/** @deprecated trust_score — retained in DB for migration compat; forbidden in application logic */
export const TELEMETRY_USER_DEPRECATED_FIELDS = ["trust_score"] as const;

export const TELEMETRY_USER_FORBIDDEN_FIELDS = [
  "name",
  "phone",
  "demographics",
  "medical_data",
  "care_relationships",
  "behavioral_profiles",
  "personalization_attributes",
] as const;

export const TELEMETRY_INTERACTION_REQUIRED_FIELDS = [
  "user_id",
  "input_raw",
  "output_structured",
  "risk_level",
  "latency_ms",
  "structure_valid",
  "semantic_valid",
  "input_category",
  "relief_outcome",
  "requery_detected",
  "helpful_feedback",
  "relief_signal",
  "helpful_yes_no",
  "reduced_confusion_yes_no",
  "care_context_state",
  "caregiver_depletion_state",
  "is_single_caregiver",
  "environmental_dependency_flag",
] as const;

/** care_context_state on interactions — observational label only, NOT profiling input. */
export const TELEMETRY_CARE_CONTEXT_STATE_RULE =
  "care_context_state is persisted as a shallow surface-signal label for measurement — forbidden for user profiling, segmentation, or lifecycle routing.";

/** Caregiver depletion signals on interactions — observational labels only, NOT intervention input. */
export const TELEMETRY_CAREGIVER_DEPLETION_RULE =
  "caregiver depletion signals are persisted as shallow surface-signal labels for measurement — forbidden for user profiling, segmentation, lifecycle routing, or intervention.";

export const TELEMETRY_FEEDBACK_REQUIRED_FIELDS = [
  "interaction_id",
  "helpful_yes_no",
  "reduced_confusion_yes_no",
] as const;

export const TELEMETRY_ALLOWED_TABLES = [
  "users",
  "documents",
  "interactions",
  "feedback",
  "knowledge_base",
  "policy_facts",
] as const;

export const TELEMETRY_EVENT_MODEL =
  "INPUT → Pre-Reasoning Grounding → Cognitive Decomposition → Structured Output → Relief Validation";

export const TELEMETRY_DRIFT_PREVENTION_RULE =
  "Do not use interaction telemetry as care memory; care-domain PostgreSQL tables remain authoritative for the Living Care Record.";

export const TELEMETRY_PERSISTENCE_PURPOSE = [
  "did this system reduce confusion effectively?",
  "did structure work consistently?",
  "where does cognitive relief fail?",
  "what document evidence and policy facts ground this interaction?",
] as const;
