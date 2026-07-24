/**
 * Memory domain — continuity, case history, context retrieval.
 * Stores context only — NEVER generates conclusions.
 */

import { MemoryStateSchema, MemoryEntrySchema } from "../../system-architecture/state-models";
import { CASE_SCOPED_MEMORY_RULE } from "../../system-architecture/domain-boundaries";

export const MEMORY_DOMAIN_PURPOSE =
  "Case-scoped context storage and retrieval — evidence and interaction history only.";

export const MEMORY_DOMAIN_CONTRACT =
  "Memory stores context; it does NOT generate conclusions, decisions, or interpretations.";

export const MEMORY_CASE_SCOPED_RULE = CASE_SCOPED_MEMORY_RULE;

export { MemoryStateSchema, MemoryEntrySchema };
export type { MemoryState, MemoryEntry } from "../../system-architecture/state-models";
