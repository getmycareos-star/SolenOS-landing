/**
 * Care Reality Engine Foundation — phase contracts.
 * SoT: docs/02-product/solenos-care-reality-engine-foundation.md
 * Examples in docs are illustrations only — never product templates.
 */

export const CARE_REALITY_ENGINE_PURPOSE =
  "An evolving intelligence layer that maintains an understanding of one person's changing care reality.";

export const CARE_REALITY_ENGINE_NOT = [
  "notes_app",
  "document_summarizer",
  "chatbot",
  "reminder_app",
  "medical_advice_system",
] as const;

export const CARE_REALITY_ENGINE_PHASES = [
  "identity_attribution",
  "baseline_memory",
  "core_objects",
  "situation_model",
  "evidence_pipeline",
  "change_detection",
  "behavioral_observation",
  "evidence_priority_conflict",
  "capacity_adaptation",
  "care_transition",
  "safety_boundary",
  "memory_correction",
  "orientation_validation",
] as const;

export type CareRealityEnginePhase = (typeof CARE_REALITY_ENGINE_PHASES)[number];

export const CARE_REALITY_ORIENTATION_QUESTIONS = [
  "what_is_happening",
  "what_changed",
  "what_matters_now",
  "what_remains_uncertain",
  "what_should_be_remembered",
] as const;

export const MVP_EXCLUSIONS = [
  "caregiver_community",
  "marketplace",
  "appointment_scheduling",
  "medication_reminders",
  "family_chat",
  "ai_companion_personality",
  "disease_education_library",
  "prediction_engine",
] as const;

export const EVIDENCE_PIPELINE = [
  "input",
  "evidence_understanding",
  "care_reality_update",
  "situation_relationship_engine",
  "response_contract",
] as const;

/** Real moat — not PDF summarization. */
export const CARE_REALITY_ENGINE_MOAT_TEST =
  "Messy document + text + observation → coherent Care Reality with changes, uncertainty, and next understanding.";
