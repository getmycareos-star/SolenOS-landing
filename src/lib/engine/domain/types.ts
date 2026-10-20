import type { SolenOSOutput } from "../../output-contract/types";

/** Core domain entities — ephemeral per request, no persistence. */

export type CareInputSource = "medical_doc" | "message" | "user_note";

export interface CareInput {
  raw_text: string;
  source: CareInputSource;
  timestamp: number;
}

export interface Person {
  role: "patient" | "caregiver";
  name?: string;
}

export interface Condition {
  name: string;
  certainty: "confirmed" | "mentioned" | "uncertain";
}

export interface Medication {
  name: string;
  certainty: "confirmed" | "mentioned" | "uncertain";
}

/** Extracted context — NOT longitudinal memory. */
export interface CareContext {
  patient?: Person;
  caregiver?: Person;
  conditions?: Condition[];
  medications?: Medication[];
}

export interface Interpretation {
  meaning: string;
  entities: string[];
  uncertainty_flags: boolean;
}

export interface InterpretedState {
  interpretation: Interpretation;
  context: CareContext;
  uncertain_elements: boolean;
  signal_text: string;
}

export interface CareLoad {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  drivers: string[];
}

export interface CognitiveLoadState {
  complexity_score: number;
  emotional_intensity_score: number;
  urgency_pressure_score: number;
  load: CareLoad;
  load_level: CareLoad["level"];
  why: string;
}

export type Priority =
  | "IMMEDIATE_ACTION"
  | "SOON_ACTION"
  | "MONITOR_ONLY"
  | "IGNORE_FOR_NOW";

export interface PriorityState {
  classification: Priority;
  reasons: string[];
}

export interface CareAction {
  do_now: string[];
  do_today: string[];
  ask_professional: string[];
  do_not_do: string[];
}

export interface ActionState {
  actions: CareAction;
}

export type CareOutput = SolenOSOutput;

export interface ClarityState {
  output: CareOutput;
  simplified_explanation: string;
  emotional_noise_removed: boolean;
}

export interface LoopSignal {
  clarityReached: boolean;
  requeryWithin30s: boolean;
  sessionExit: boolean;
  userFrustrationSignals: boolean;
}

export interface LoopState {
  relief_detected: boolean;
  confusion_persisted: boolean;
  loop_closed: boolean;
}

/** Full ephemeral state trace — debug only, never persisted. */
export interface StateTrace {
  interpreted: InterpretedState;
  cognitive_load: CognitiveLoadState;
  priority: PriorityState;
  actions: ActionState;
  clarity: ClarityState;
}

export const AMBIGUITY_THRESHOLD = 0.35;
