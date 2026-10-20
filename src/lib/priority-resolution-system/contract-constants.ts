/** Priority Resolution System — one dominant output mode per input cycle. */

export const PRIORITY_RESOLUTION_IDENTITY =
  "SolenOS must always execute exactly ONE dominant behavior per input cycle.";

export const PRIORITY_RESOLUTION_DEFINING_PRINCIPLE =
  "SolenOS does not decide what to show. It resolves competing realities into a single dominant cognitive frame.";

/** Hard precedence — highest first. Non-negotiable. */
export const OUTPUT_MODE_PRIORITY = [
  "crisis_mode",
  "first_60s_value_loop",
  "return_value_loop",
  "state_of_care_summary",
  "clarification_mode",
] as const;

export const OUTPUT_MODE_DEFINITIONS: Record<
  (typeof OUTPUT_MODE_PRIORITY)[number],
  { label: string; behavior: string }
> = {
  crisis_mode: {
    label: "Crisis Mode",
    behavior: "Immediate, minimal, action-first — overrides all other systems",
  },
  first_60s_value_loop: {
    label: "First 60 Seconds Value Loop",
    behavior: "Maximize instant comprehension — CareEvent + insight + max 1 clarification",
  },
  return_value_loop: {
    label: "Return Value Loop",
    behavior: "Show what changed while the user was away",
  },
  state_of_care_summary: {
    label: "State of Care Summary",
    behavior: "Current care state snapshot — default ongoing mode",
  },
  clarification_mode: {
    label: "Clarification Engine",
    behavior: "Max 1 structured question only when necessary",
  },
};

export const PRIORITY_RESOLUTION_RULES = [
  "single_output_mode_per_cycle",
  "highest_priority_wins_exclusively",
  "internal_parallelism_allowed",
  "no_mode_mixing",
  "deterministic_trigger_resolution",
] as const;
