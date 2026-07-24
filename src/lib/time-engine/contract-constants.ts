/** Time Engine Layer — temporal reasoning and urgency transformation only. */

export const TIME_ENGINE_LAYER_IDENTITY =
  "a temporal reasoning layer that converts time signals into priority weight structures without scheduling, reminders, or urgency hallucination";

export const TIME_ENGINE_LAYER_ONE_LINE_TRUTH =
  "Time Engine transforms time into priority weight signals — it never schedules events, generates reminders, or assumes urgency without context.";

export const TIME_ENGINE_LAYER_PIPELINE_POSITION =
  "TIME ENGINE LAYER — after Memory Influence and Care Profile emotional weighting; before Priority Engine and conflict resolution";

export const TIME_ENGINE_LAYER_FORBIDDEN = [
  "schedule events or create calendar entries",
  "generate reminders or notification timing",
  "assume urgency without temporal context",
  "override reasoning or medical urgency detection",
  "pass raw timestamps to LLM as unclassified facts",
  "infer deadlines when time is missing",
  "merge care-context timePressure into urgency score",
] as const;

/** Hours boundaries for horizon classification (before timezone shift). */
export const HORIZON_HOURS = {
  NOW_MAX: 4,
  TODAY_MAX: 24,
  SOON_MAX: 72,
} as const;

/** Urgency decay λ — hours since relevance. urgencyDecay(t) = exp(-λ * t). */
export const URGENCY_DECAY_LAMBDA = 0.08;

/** Base urgency by horizon before decay (0–1). */
export const HORIZON_URGENCY_BASE: Record<"NOW" | "TODAY" | "SOON" | "LATER", number> = {
  NOW: 0.95,
  TODAY: 0.7,
  SOON: 0.45,
  LATER: 0.2,
};

export const UNSCHEDULED_TEMPORAL_LABEL = "UNSCHEDULED TEMPORAL STATE" as const;

export const TIME_HORIZON_KEYS = ["NOW", "TODAY", "SOON", "LATER"] as const;

/** Max timezone/coarse-location horizon shift in hours — classification only. */
export const MAX_TIMEZONE_HORIZON_SHIFT_HOURS = 1;
