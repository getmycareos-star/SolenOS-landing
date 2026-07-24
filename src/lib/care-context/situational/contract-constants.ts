/** Situational Care Context Layer — ephemeral real-time state, NOT identity or settings. */

export const CARE_CONTEXT_LAYER_IDENTITY =
  "a per-interaction situational state snapshot that feeds urgency weighting and module envelopes without persisting identity or merging into Care Profile";

export const CARE_CONTEXT_LAYER_ONE_LINE_TRUTH =
  "Care Context answers what is happening now — it is recomputed every interaction, never stored as long-term memory, and never defines who the user is.";

export const CARE_CONTEXT_LAYER_PIPELINE_POSITION =
  "CARE CONTEXT LAYER — after input classification and clarity gate; before Care Profile Layer";

export const CARE_CONTEXT_LAYER_FORBIDDEN = [
  "long-term memory storage",
  "merge into Care Profile identity",
  "persistence across sessions",
  "settings-governance careContext mirror",
  "LLM identity profiling",
  "assume persistence across sessions",
] as const;

export const SITUATION_TYPES = [
  "daily_routine",
  "medical_event",
  "emergency",
  "administrative",
  "uncertain_state",
  "follow_up",
] as const;

export const CARE_CONTEXT_URGENCY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const LOCATION_CONTEXTS = ["home", "hospital", "clinic", "external", "unknown"] as const;

export const TIME_PRESSURE_LEVELS = ["none", "low", "medium", "high"] as const;

export const INTERRUPTION_RISK_LEVELS = ["low", "medium", "high"] as const;

/** Intent confidence below this → treat as uncertain; must not assume action. */
export const CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD = 0.6;

/** Max recent events retained in ephemeral request-scope buffer. */
export const CARE_CONTEXT_RECENT_EVENTS_MAX = 5;
