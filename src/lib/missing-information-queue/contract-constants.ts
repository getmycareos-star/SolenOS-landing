/** Missing Information Queue — tracks knowledge gaps that affect reasoning, NOT work/tasks. */

export const MISSING_INFORMATION_QUEUE_LAYER_IDENTITY =
  "a continuous queue that identifies, prioritizes, and surfaces missing knowledge that materially affects reasoning quality — never tasks, checklists, or onboarding";

export const MISSING_INFORMATION_QUEUE_LAYER_ONE_LINE_TRUTH =
  "Missing information is knowledge still needed to reason well — complementary to assumptions (what is treated as true), never a task manager.";

export const MISSING_INFORMATION_QUEUE_LAYER_PIPELINE_POSITION =
  "MISSING INFORMATION QUEUE LAYER — after Assumption Registry; before Priority Engine. High-priority open gaps lower confidence and raise uncertainty.";

export const MISSING_INFORMATION_QUEUE_LAYER_FORBIDDEN = [
  "task manager or to-do list behavior",
  "checklist or onboarding question flows",
  "action verbs as queue items (call, schedule, submit, follow up)",
  "global items without situationId",
  "dedicated sidebar section for missing information",
  "merging into Assumption Registry",
] as const;

export const MISSING_INFORMATION_STATUSES = [
  "open",
  "resolved",
  "expired",
] as const;

export const MISSING_INFORMATION_SOURCES = [
  "reasoning",
  "document",
  "memory",
  "user_input",
] as const;

export const MISSING_INFORMATION_IMPORTANCE = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

/** Open gaps older than this expire (optional lifecycle). */
export const DEFAULT_MISSING_INFORMATION_EXPIRATION_DAYS = 60;

/** Soft confidence reduction cap when high-priority gaps are open. */
export const MISSING_INFORMATION_CONFIDENCE_PENALTY_CAP = 0.45;

/** Uncertainty boost per high-priority open item (clamped). */
export const MISSING_INFORMATION_UNCERTAINTY_PER_HIGH = 0.12;

export const CRITICAL_GAP_WARNING =
  "Critical information gaps are limiting recommendation quality.";
