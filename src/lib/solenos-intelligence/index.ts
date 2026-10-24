/**
 * SolenOS Intelligence Layer — public API.
 *
 * This module provides the explicit intelligence boundary for all
 * caregiver input. It replaces the implicit procedural chain with
 * explicit stages: Intent → Memory → Data Acquisition → Understanding →
 * Memory Strategy → Reasoning → Active Situation → Communication.
 */

export {
  buildSolenOSSystemPrompt,
  buildUnderstandingSystemPrompt,
  appendMetaRule,
  META_RULE,
  BEHAVIORAL_RULES,
} from "./prompts";

export {
  applyReasoning,
} from "./reasoning";

export {
  applyMemoryStrategy,
} from "./memory-strategy";

/** Database-backed pipeline entry points are server-only; use the backend API from the browser. */

export type {
  SolenOSInput,
  SolenOSMemory,
  IntelligenceStage,
  UnderstandingResult,
  ReasoningResult,
  MemoryStrategyResult,
  IntelligenceResult,
  IntelligenceOptions,
} from "./types";
