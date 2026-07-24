import type {
  CognitiveLoadState,
  InterpretedState,
  Priority,
  PriorityState,
} from "./domain/types";

/**
 * COGNITIVE_LOAD_STATE → PRIORITY_STATE
 * Classifies what demands attention now vs later.
 */
export function prioritize(
  interpreted: InterpretedState,
  load: CognitiveLoadState,
): PriorityState {
  const text = interpreted.signal_text;
  const reasons: string[] = [];

  let classification: Priority;

  if (load.urgency_pressure_score >= 0.7) {
    classification = "IMMEDIATE_ACTION";
    reasons.push("High medical urgency signals detected");
  } else if (
    load.urgency_pressure_score >= 0.4 ||
    load.load_level === "critical"
  ) {
    classification = "SOON_ACTION";
    reasons.push("Time-sensitive care coordination needed");
  } else if (
    load.complexity_score >= 0.4 ||
    interpreted.uncertain_elements
  ) {
    classification = "MONITOR_ONLY";
    reasons.push("Situation requires observation and clarification");
  } else {
    classification = "IGNORE_FOR_NOW";
    reasons.push("No immediate action signals — maintain awareness");
  }

  if (/\b(discharge|medication|doctor said)\b/i.test(text)) {
    if (classification === "IGNORE_FOR_NOW") classification = "MONITOR_ONLY";
    reasons.push("Medical instructions require verification");
  }

  if (load.emotional_intensity_score >= 0.6 && classification === "IGNORE_FOR_NOW") {
    classification = "MONITOR_ONLY";
    reasons.push("Caregiver emotional load warrants attention");
  }

  return { classification, reasons };
}

export function priorityToRisk(
  priority: Priority,
): "low" | "medium" | "high" {
  switch (priority) {
    case "IMMEDIATE_ACTION":
      return "high";
    case "SOON_ACTION":
      return "medium";
    default:
      return "low";
  }
}
