import type { InputMode } from "../../input-classification";
import type { UrgencyDetectionResult } from "../../urgency-detection";
import { CARE_CONTEXT_RECENT_EVENTS_MAX } from "./contract-constants";
import type {
  InterruptionRisk,
  LocationContext,
  TimePressure,
} from "./types";

const LOCATION_PATTERNS: ReadonlyArray<{ context: LocationContext; pattern: RegExp }> = [
  { context: "hospital", pattern: /\b(hospital|emergency room|ER|ICU)\b/i },
  { context: "clinic", pattern: /\b(clinic|doctor'?s office|physician)\b/i },
  { context: "home", pattern: /\b(at home|home care|in home|our house)\b/i },
  { context: "external", pattern: /\b(on the road|traveling|away from home|at work)\b/i },
];

const TIME_PRESSURE_PATTERNS: ReadonlyArray<{ level: TimePressure; pattern: RegExp }> = [
  { level: "high", pattern: /\b(right now|immediately|asap|urgent(ly)?|within (an? hour|minutes))\b/i },
  { level: "medium", pattern: /\b(today|tonight|this (morning|afternoon|evening)|deadline)\b/i },
  { level: "low", pattern: /\b(soon|this week|when (you|I) can)\b/i },
];

const INTERRUPTION_PATTERNS: ReadonlyArray<{ level: InterruptionRisk; pattern: RegExp }> = [
  { level: "high", pattern: /\b(on the phone|quick(ly)?|can'?t talk long|interrupted|one minute)\b/i },
  { level: "medium", pattern: /\b(at work|busy|limited time|between (meetings|shifts))\b/i },
];

const CONSTRAINT_PATTERNS = [
  { label: "medication_timing", pattern: /\b(missed (dose|medication)|before (eating|bed)|with food)\b/i },
  { label: "safety_supervision", pattern: /\b(wandering|fall risk|supervision|alone at home)\b/i },
  { label: "time_deadline", pattern: /\b(deadline|due (today|tomorrow)|expires)\b/i },
  { label: "clinical_boundary", pattern: /\b(diagnos(e|is)|prescri(be|ption)|dosage)\b/i },
  { label: "emergency_escalation", pattern: /\b(call 911|emergency services|not breathing)\b/i },
] as const;

const EVENT_PATTERNS = [
  /\b(missed|forgot|skipped) (her|his|their|the|a) (dose|medication|pill)\b/i,
  /\b(fell|fall|fainted)\b/i,
  /\b(discharge(d)?|admitted|hospitalized)\b/i,
  /\b(symptom|pain|fever|confusion) (started|worsened|returned)\b/i,
  /\b(appointment|visit) (cancelled|missed|scheduled)\b/i,
] as const;

const UNRESOLVED_PATTERNS = [
  /\bnot sure (what|if|whether|how)\b/i,
  /\bdon'?t know (what|if|whether|how|who)\b/i,
  /\bunclear (what|if|whether)\b/i,
  /\bneed (to know|help figuring|clarity)\b/i,
  /\bwhat should I (do|ask|say)\b/i,
  /\bconflicting (information|advice)\b/i,
  /\bmissing (information|details|context)\b/i,
] as const;

const EXPLICIT_INTENT_PATTERNS = [
  { intent: "seek_guidance", pattern: /\b(what should I|help me (decide|figure)|need advice)\b/i },
  { intent: "seek_clarification", pattern: /\b(is this (normal|serious)|should I (call|worry))\b/i },
  { intent: "report_event", pattern: /\b(just happened|this morning|today (she|he|they))\b/i },
  { intent: "administrative_action", pattern: /\b(file|submit|appeal|apply for)\b/i },
] as const;

const INFERRED_INTENT_PATTERNS = [
  { intent: "routine_check", pattern: /\b(daily|routine|reminder|schedule)\b/i },
  { intent: "escalation_concern", pattern: /\b(worsening|getting worse|emergency)\b/i },
  { intent: "coordination", pattern: /\b(coordinate|schedule|arrange|organize)\b/i },
] as const;

export function extractLocationContext(input: string): LocationContext | undefined {
  for (const { context, pattern } of LOCATION_PATTERNS) {
    if (pattern.test(input)) return context;
  }
  return undefined;
}

export function extractTimePressure(input: string, urgencyDetection: UrgencyDetectionResult): TimePressure {
  for (const { level, pattern } of TIME_PRESSURE_PATTERNS) {
    if (pattern.test(input)) return level;
  }
  if (urgencyDetection.risk_level === "critical" || urgencyDetection.risk_level === "high") {
    return "high";
  }
  if (urgencyDetection.risk_level === "medium") {
    return "medium";
  }
  return "none";
}

export function extractInterruptionRisk(input: string): InterruptionRisk {
  for (const { level, pattern } of INTERRUPTION_PATTERNS) {
    if (pattern.test(input)) return level;
  }
  return "low";
}

export function extractActiveConstraints(input: string, inputMode: InputMode): string[] {
  const constraints = CONSTRAINT_PATTERNS.filter(({ pattern }) => pattern.test(input)).map(
    ({ label }) => label,
  );

  if (inputMode === "crisis_urgent" && !constraints.includes("emergency_escalation")) {
    constraints.push("emergency_escalation");
  }

  if (inputMode === "administrative_legal" && !constraints.includes("time_deadline")) {
    constraints.push("time_deadline");
  }

  return [...new Set(constraints)];
}

export function extractRecentEventsFromInput(input: string): string[] {
  return EVENT_PATTERNS.filter((pattern) => pattern.test(input)).map((pattern) =>
    pattern.source.slice(0, 48),
  );
}

/**
 * Merge ephemeral request-scope event buffer — never persisted across sessions.
 */
export function mergeRecentEventsBuffer(
  priorBuffer: string[] | undefined,
  fromInput: string[],
): string[] {
  const merged = [...(priorBuffer ?? []), ...fromInput];
  return [...new Set(merged)].slice(-CARE_CONTEXT_RECENT_EVENTS_MAX);
}

export function extractUnresolvedItems(input: string): string[] {
  return UNRESOLVED_PATTERNS.filter((pattern) => pattern.test(input)).map((pattern) =>
    pattern.source.slice(0, 40),
  );
}

export function extractUserIntentSignal(input: string): {
  explicitIntent?: string;
  inferredIntent?: string;
  confidence: number;
} {
  for (const { intent, pattern } of EXPLICIT_INTENT_PATTERNS) {
    if (pattern.test(input)) {
      return { explicitIntent: intent, confidence: 0.82 };
    }
  }

  for (const { intent, pattern } of INFERRED_INTENT_PATTERNS) {
    if (pattern.test(input)) {
      return { inferredIntent: intent, confidence: 0.55 };
    }
  }

  if (input.trim().length >= 40) {
    return { inferredIntent: "general_care_situation", confidence: 0.5 };
  }

  return { confidence: 0.35 };
}
