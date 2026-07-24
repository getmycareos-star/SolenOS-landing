export type EpisodicReliefViolationCode =
  | "retention_language"
  | "engagement_loop"
  | "dependency_framing"
  | "platform_behavior"
  | "onboarding_prompt"
  | "habit_formation"
  | "multi_step_flow";

export const EPISODIC_RELIEF_VIOLATION_CODES: readonly EpisodicReliefViolationCode[] =
  [
    "retention_language",
    "engagement_loop",
    "dependency_framing",
    "platform_behavior",
    "onboarding_prompt",
    "habit_formation",
    "multi_step_flow",
  ] as const;

/** Section 7 — forbidden product behavior in model output. */
export const RETENTION_ENGAGEMENT_PATTERNS = [
  /\bcome back (?:to (?:the app|solenos|this tool))\b/i,
  /\bcheck in regularly\b/i,
  /\benable notifications\b/i,
  /\bset a reminder to (?:return|check|log in)\b/i,
  /\btrack your progress\b/i,
  /\bnext session\b/i,
  /\bcreate an account\b/i,
  /\bsign up to continue\b/i,
  /\bbuild a habit\b/i,
  /\bstay tuned\b/i,
  /\bwe'?ll follow up with you\b/i,
  /\bschedule your next (?:visit|check-in|session)\b/i,
  /\breturn tomorrow\b/i,
  /\bkeep using solenos\b/i,
] as const;

export const DEPENDENCY_FRAMING_PATTERNS = [
  /\bkeep coming back\b/i,
  /\buse this (?:app|tool|system) (?:daily|regularly|often)\b/i,
  /\bdepend on solenos\b/i,
  /\bmake solenos part of your routine\b/i,
] as const;

export const PLATFORM_BEHAVIOR_PATTERNS = [
  /\bopen your dashboard\b/i,
  /\bview your (?:care )?timeline\b/i,
  /\bmanage your tasks here\b/i,
  /\bcomplete onboarding\b/i,
  /\bset up your profile\b/i,
] as const;

export const MULTI_STEP_FLOW_PATTERNS = [
  /\bstep 1 of \d+\b/i,
  /\bnext, we'?ll ask you to\b/i,
  /\bcontinue to the next screen\b/i,
  /\bfinish setup to proceed\b/i,
] as const;

export interface EpisodicReliefResult {
  valid: boolean;
  violations: EpisodicReliefViolationCode[];
}

/** Forbidden product surface patterns — verified at architecture boundary. */
export const EPISODIC_FORBIDDEN_PRODUCT_PATTERNS = [
  "dashboard",
  "onboarding",
  "gamification",
  "habit",
  "retention",
  "workflow",
  "task manager",
  "multi-session",
  "notification",
] as const;
