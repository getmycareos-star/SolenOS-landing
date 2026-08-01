/**
 * Greeting Orientation types.
 *
 * This module projects existing care state into caregiver-facing orientation.
 * It does NOT create new state, memory, or conversation state.
 *
 * SolenOS does not respond to greetings. It responds to system state.
 * The orientation text is a bridge into care continuity — not a conversation opener.
 */
import type { ContinuityDecision, CareIdentitySummary } from "../care-identity";
import type { CareRealityState } from "../care-reality-state/types";
import type { CareRealityMemoryObject } from "../care-reality-intelligence/care-reality-memory";

/**
 * The context that drives greeting orientation.
 * All fields are projections of existing care state — no new state.
 */
export type GreetingOrientationContext = {
  /** Whether this is a first-ever session (no identity, no care events) */
  is_first_session: boolean;
  /** The continuity decision from Care Identity engine */
  continuity: ContinuityDecision;
  /** Identity summary from Care Identity engine */
  identity: CareIdentitySummary;
  /** Current Care Reality State (may be null if no care established yet) */
  crs: CareRealityState | null;
  /** Summary of care reality memory objects (may be empty) */
  memory: CareRealityMemorySummary;
  /** The raw input that triggered this greeting (casual greeting, "how are you", "thanks", etc.) */
  raw_input: string;
  /** Whether the input is a casual greeting like "hi" / "hello" / "good morning" */
  is_casual_greeting: boolean;
  /** Whether the input is asking "how are you?" or similar */
  is_how_are_you: boolean;
/** Whether the input is thanking / gratitude */
  is_gratitude: boolean;
  /** Whether the input describes a change in the care recipient's condition */
  is_change_oriented: boolean;
};

/**
 * The greeting orientation output.
 * This is the ONLY place greeting text is generated.
 */
export type GreetingOrientationOutput = {
  /** The orientation line — first thing caregiver sees. Null = no greeting needed. */
  orientation_line: string | null;
  /** Whether to show orientation at all (false for care-event inputs that don't need greeting) */
  should_orient: boolean;
  /** The type of orientation applied */
  orientation_kind: "new_caregiver" | "returning_no_threads" | "returning_with_threads" | "casual_greeting" | "how_are_you" | "gratitude" | "change_detected" | "none";
};

/** Memory summary shape used by orientation — derived from existing care systems. */
export type CareRealityMemorySummary = {
  has_events: boolean;
  has_observations: boolean;
  has_decisions: boolean;
  has_open_unknowns: boolean;
  event_count: number;
  observation_count: number;
  /** Top-priority descriptions for orientation context */
  top_observations: string[];
  top_events: string[];
  open_unknowns: string[];
  continuity_hooks: string[];
};

