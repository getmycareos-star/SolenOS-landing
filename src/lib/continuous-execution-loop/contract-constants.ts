/** Continuous execution loop — the runtime engine connecting input to output. */

export const CONTINUOUS_EXECUTION_IDENTITY =
  "SolenOS runs a single persistent loop: INPUT → PARSE → NORMALIZE → UPDATE STATE → DIFF → GENERATE OUTPUT → WAIT";

export const EXECUTION_LOOP_PHASES = [
  "input",
  "parse",
  "normalize",
  "update_state",
  "diff",
  "generate_output",
  "wait",
] as const;

export const UNIFIED_INPUT_TYPES = [
  "situation",
  "document",
  "correction",
  "follow_up_answer",
  "observation",
  "update",
  "idle_refresh",
] as const;

export const STATE_UPDATE_OPERATIONS = ["add", "correct", "link"] as const;

export const UNCERTAINTY_STATES = ["OPEN", "ASKED", "ANSWERED", "INVALIDATED"] as const;

export const SYSTEM_MODES = ["empty", "bootstrap", "continuous"] as const;

export const EXECUTION_LOOP_DEFINITION =
  "An event-sourced system that continuously transforms unstructured real-world inputs into a versioned continuity state through a deterministic execution loop governed by diff-based state updates and explicit uncertainty management.";

export const MAX_DIFF_SUMMARY_LINES = 12;
export const MAX_SURFACED_PRIORITY_ITEMS = 8;
