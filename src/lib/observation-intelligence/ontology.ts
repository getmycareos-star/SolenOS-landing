export const OBSERVATION_CATEGORIES = [
  "memory",
  "orientation",
  "communication",
  "mood",
  "behavior",
  "daily_function",
] as const;

export type ObservationCategory = (typeof OBSERVATION_CATEGORIES)[number];

export const OBSERVATION_SIGNALS = {
  memory: [
    "repeated_questioning",
    "forgetting_conversations",
    "misplacing_objects",
    "recognition_failure",
  ],
  orientation: [
    "getting_lost",
    "confusion_about_date",
    "confusion_about_location",
    "confusion_about_time",
  ],
  communication: [
    "word_finding_difficulty",
    "stopping_mid_sentence",
    "repeating_stories",
    "comprehension_issue",
  ],
  mood: ["anxiety", "depression", "agitation", "irritability", "emotional_withdrawal"],
  behavior: ["wandering", "impulsivity", "paranoia", "hallucinations", "repetitive_actions"],
  daily_function: [
    "medication_errors",
    "financial_errors",
    "dressing_difficulty",
    "eating_difficulty",
    "hygiene_difficulty",
  ],
} as const satisfies Record<ObservationCategory, readonly string[]>;

export type MemorySignal = (typeof OBSERVATION_SIGNALS.memory)[number];
export type OrientationSignal = (typeof OBSERVATION_SIGNALS.orientation)[number];
export type CommunicationSignal = (typeof OBSERVATION_SIGNALS.communication)[number];
export type MoodSignal = (typeof OBSERVATION_SIGNALS.mood)[number];
export type BehaviorSignal = (typeof OBSERVATION_SIGNALS.behavior)[number];
export type DailyFunctionSignal = (typeof OBSERVATION_SIGNALS.daily_function)[number];

export type ObservationSignal =
  | MemorySignal
  | OrientationSignal
  | CommunicationSignal
  | MoodSignal
  | BehaviorSignal
  | DailyFunctionSignal;

export type ObservationSeverity = "low" | "medium" | "high";

export type StructuredObservation = {
  category: ObservationCategory;
  signal: ObservationSignal;
  severity: ObservationSeverity;
};

const signalToCategory = new Map<ObservationSignal, ObservationCategory>();
for (const category of OBSERVATION_CATEGORIES) {
  for (const signal of OBSERVATION_SIGNALS[category]) {
    signalToCategory.set(signal as ObservationSignal, category);
  }
}

export function categoryForSignal(signal: ObservationSignal): ObservationCategory {
  const category = signalToCategory.get(signal);
  if (!category) throw new Error(`Unknown observation signal: ${signal}`);
  return category;
}

export function isValidSignalForCategory(
  category: ObservationCategory,
  signal: string,
): signal is ObservationSignal {
  return (OBSERVATION_SIGNALS[category] as readonly string[]).includes(signal);
}

export function allSignals(): ObservationSignal[] {
  return OBSERVATION_CATEGORIES.flatMap(
    (c) => OBSERVATION_SIGNALS[c] as readonly ObservationSignal[],
  );
}
