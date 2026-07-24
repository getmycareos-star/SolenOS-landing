import { z } from "zod";

import { CANONICAL_RISK_LEVELS } from "../canonical-architecture/contract";

/**
 * Explicit, observable state models — each domain exposes its state shape.
 * MVP foundation: types only; persistence wiring is future work.
 */

export const CaseStatusSchema = z.enum(["active", "closed", "archived"]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const CaseStateSchema = z.object({
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: CaseStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CaseState = z.infer<typeof CaseStateSchema>;

export const RiskLevelSchema = z.enum(CANONICAL_RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskStateSchema = z.object({
  risk_level: RiskLevelSchema,
  escalation_active: z.boolean(),
  detected_at: z.string().datetime(),
  source: z.enum(["input_signals", "safety_override", "manual"]),
});
export type RiskState = z.infer<typeof RiskStateSchema>;

export const CurrentCareStateSchema = z.object({
  /** Shallow observational label — NOT profiling or lifecycle routing. */
  care_context_state: z.enum(["active_care", "crisis", "post_care", "uncertain"]),
  single_caregiver: z.boolean().optional(),
  environmental_dependency: z.boolean().optional(),
});
export type CurrentCareState = z.infer<typeof CurrentCareStateSchema>;

export const MemoryEntrySchema = z.object({
  case_id: z.string().uuid(),
  entry_type: z.enum(["interaction", "document", "context_note"]),
  content_ref: z.string(),
  stored_at: z.string().datetime(),
  /** Memory stores context only — never generated conclusions. */
  is_conclusion: z.literal(false),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const MemoryStateSchema = z.object({
  case_id: z.string().uuid(),
  entries: z.array(MemoryEntrySchema),
  /** Case-scoped only — no global user memory. */
  scope: z.literal("case"),
});
export type MemoryState = z.infer<typeof MemoryStateSchema>;

export const UserContextStateSchema = z.object({
  user_id: z.string().uuid(),
  session_active: z.boolean(),
  /** Session/identity context only — NOT longitudinal profiling. */
  auth_enabled: z.boolean(),
});
export type UserContextState = z.infer<typeof UserContextStateSchema>;
