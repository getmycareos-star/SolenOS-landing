/**
 * Case domain — case creation, ownership, lifecycle.
 * All continuity scoped to case. NO global user memory.
 */

import { z } from "zod";

import { CaseStateSchema, CaseStatusSchema } from "../../system-architecture/state-models";
import { CASE_SCOPED_MEMORY_RULE } from "../../system-architecture/domain-boundaries";

export const CASE_DOMAIN_PURPOSE =
  "Case-scoped continuity container — every interaction and memory entry belongs to a case.";

export const CASE_DOMAIN_RULE = CASE_SCOPED_MEMORY_RULE;

export const CaseCreateInputSchema = z.object({
  user_id: z.string().uuid(),
  status: CaseStatusSchema.default("active"),
});

export type CaseCreateInput = z.infer<typeof CaseCreateInputSchema>;

export { CaseStateSchema, CaseStatusSchema };
export type { CaseState, CaseStatus } from "../../system-architecture/state-models";
