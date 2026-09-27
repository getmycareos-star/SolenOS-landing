/** Semantic extraction schema — what Qwen extracts from caregiver notes. */

export const EXTRACTION_SCHEMA_VERSION = "1.0.0";

export type ExtractionObservation = {
  type: "symptom" | "behavior" | "functional_change" | "cognitive_change" | "mood_change" | "other";
  description: string;
  severity?: "mild" | "moderate" | "severe" | null;
  source_person?: string | null;
  source_role?: "patient" | "caregiver" | "family" | "clinician" | "document" | "unknown" | null;
  temporal_context?: string | null;
  uncertainty?: "reported" | "observed" | "suspected" | null;
};

export type ExtractionMeasurement = {
  type: string;
  value: number | string;
  unit?: string | null;
  systolic?: number | null;
  diastolic?: number | null;
  time?: string | null;
  date?: string | null;
  temporal_precision?: "exact" | "approximate" | "relative" | "uncertain";
  source_person?: string | null;
  uncertainty?: string | null;
};

export type ExtractionMedication = {
  name: string;
  reported_action?: "taken" | "not_taken" | "missed" | "uncertain" | "administered_by_others" | null;
  administration_status?: "taken" | "not_taken" | "uncertain" | null;
  source_person?: string | null;
  temporal_context?: string | null;
  uncertainty?: string | null;
  note?: string | null;
};

export type ExtractionTemporalFact = {
  description: string;
  time_reference?: string | null;
  date_reference?: string | null;
  precision?: "exact" | "approximate" | "relative" | "uncertain" | null;
  ordering?: string | null;
};

export type ExtractionAttribution = {
  person: string;
  role: "patient" | "caregiver" | "family" | "clinician" | "document" | "unknown";
  claim: string;
  confidence?: number | null;
};

export type ExtractionContradiction = {
  claim_a: string;
  claim_b: string;
  claim_a_source?: string | null;
  claim_b_source?: string | null;
  evidence?: string | null;
  unresolved: true;
};

export type ExtractionUncertainty = {
  field: string;
  description: string;
  reason?: string | null;
};

export type ExtractionQuestion = {
  question: string;
  topic?: string | null;
};

export type ExtractionAppointment = {
  clinician?: string | null;
  date?: string | null;
  time?: string | null;
  type?: string | null;
  certainty?: "confirmed" | "planned" | "uncertain" | "unknown";
  source_person?: string | null;
};

/**
 * Where the structured facts came from.
 * `rules` never means "model unavailable" — the rule floor always runs so
 * understanding is structured even when every LLM attempt fails.
 */
export type ExtractionSource = "llm" | "rules" | "llm+rules";

/**
 * What the extraction actually covered. Used to know whether understanding is
 * thin or rich — never as confidence-score theater.
 */
export type ExtractionCoverage = {
  observations: number;
  measurements: number;
  medications: number;
  temporal_facts: number;
  questions: number;
  appointments: number;
  uncertainties: number;
  contradictions: number;
  attributions: number;
  caregiver_load_signals: number;
  /** True when at least one concrete, checkable fact was extracted. */
  has_structured_fact: boolean;
};

/**
 * Caregiver-capacity signals (exhaustion, isolation, competing demands).
 * Structurally separated from care-recipient observations so caregiver load is
 * never reported as a change in the person receiving care.
 */
export type CaregiverLoadSignal = {
  kind:
    | "exhaustion"
    | "overwhelmed"
    | "time_pressure"
    | "isolation"
    | "guilt"
    | "grief"
    | "uncertainty"
    | "competing_demands"
    | "financial_strain"
    | "hope";
  /** Verbatim carrier span — evidence for the signal. */
  evidence: string;
  /** Phrasing strength; used for relief decisions, never shown as a score. */
  intensity: "low" | "medium" | "high";
};

export type SemanticExtraction = {
  schema_version: string;
  observations: ExtractionObservation[];
  measurements: ExtractionMeasurement[];
  medications: ExtractionMedication[];
  temporal_facts: ExtractionTemporalFact[];
  attributions: ExtractionAttribution[];
  contradictions: ExtractionContradiction[];
  uncertainties: ExtractionUncertainty[];
  questions: ExtractionQuestion[];
  appointments: ExtractionAppointment[];
  extraction_confidence: number;
  extraction_notes?: string | null;
  /** Which engines contributed this extraction. */
  source?: ExtractionSource;
  /** True when the LLM path contributed nothing and the rule floor carried it. */
  degraded?: boolean;
  /** Field-level coverage — used to decide richness, not to grade the model. */
  coverage?: ExtractionCoverage;
  /** Caregiver capacity signals held alongside care facts. */
  caregiver_load_signals?: CaregiverLoadSignal[];
};

export type ExtractionResult = {
  success: boolean;
  extraction: SemanticExtraction | null;
  raw_response: string;
  parsed_content: unknown | null;
  duration_ms: number;
  model: string;
  provider: string;
  error?: string | null;
  /** Every model attempted, in order. */
  models_attempted?: string[];
  /** Non-fatal salvage notes (aliased fields, repaired schema_version, …). */
  repair_notes?: string[];
  /** How many structured facts the rule floor recovered independently. */
  rule_floor_facts?: number;
  /** Qwen reasoning layer output — intent, synthesis, contradictions, baseline, uncertainty. */
  reasoning?: import("./reasoning-engine").QwenReasoningOutput | null;
};