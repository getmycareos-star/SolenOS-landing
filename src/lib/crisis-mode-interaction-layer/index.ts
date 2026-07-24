export {
  CRISIS_MODE_IDENTITY,
  CRISIS_MODE_DEFINING_PRINCIPLE,
  CRISIS_URGENCY_LEVELS,
  CRISIS_BEHAVIOR_RULES,
  CRISIS_SUPPRESSED_ENGINES,
  HIGH_SEVERITY_EVENT_PATTERNS,
  MAX_LINES_PER_SECTION,
} from "./contract-constants";

export type {
  CrisisUrgencyLevel,
  CrisisUiMode,
  CrisisModeOutput,
  CrisisModeInteractionResult,
  ProcessCrisisModeInput,
} from "./types";

export { processCrisisModeInteraction } from "./pipeline";
export { resetCrisisModeStore } from "./store";
export {
  isAcuteCrisisFall,
  hasFallCrisisImmediacy,
  hasFallCrisisSeverity,
  mentionsFall,
} from "./fall-crisis-gate";
export { detectCrisisTriggers, crisisModeActive } from "./detect-triggers";
