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
};