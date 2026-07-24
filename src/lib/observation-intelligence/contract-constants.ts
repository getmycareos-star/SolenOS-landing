/** Observation Intelligence MVP — caregiver observation language → structured patterns. */

export const OBSERVATION_INTELLIGENCE_IDENTITY =
  "SolenOS Observation Intelligence — understands what caregivers observe, not medical truth";

export const OBSERVATION_INTELLIGENCE_PHILOSOPHY =
  "Capture → Structure → Summarize → Reveal Patterns (NOT Explain → Diagnose → Predict → Advise)";

export const OBSERVATION_INTELLIGENCE_SUCCESS_KPI =
  "observations_per_caregiver_per_week";

export const OBSERVATION_INTELLIGENCE_PIPELINE_POSITION =
  "PARALLEL to analyze-pipeline — POST /api/observations (not LLM decision path)";

export const OBSERVATION_FORBIDDEN_OUTPUT = [
  "Stage 4 dementia",
  "Alzheimer's diagnosis",
  "clinical certainty",
  "medication recommendations",
  "90-day decline prediction",
  "dementia diagnosis",
  "disease progression",
  "treatment recommendations",
  "clinical decision support",
] as const;

export const OBSERVATION_ANTI_PATTERNS = [
  "diagnosing dementia or Alzheimer's from observations",
  "predicting disease timeline from frequency trends",
  "recommending medications or treatments",
  "clinical certainty language in aggregation output",
  "conversational chatbot for observation intake",
  "Hello I'm SolenOS AI companion-style voice UX",
] as const;

export const OBSERVATION_SEVERITY_LEVELS = ["low", "medium", "high"] as const;

export const OBSERVATION_SOURCES = ["text", "voice"] as const;

export const OBSERVATION_RISK_LEVELS = ["low", "medium", "high"] as const;
