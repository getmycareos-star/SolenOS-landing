import { z } from "zod";
import { CARE_CONTEXT_STATES } from "./contract-constants";

export const CareContextStateResultSchema = z
  .object({
    care_context_state: z.enum(CARE_CONTEXT_STATES),
  })
  .strict();

export type CareContextStateResult = z.infer<typeof CareContextStateResultSchema>;

export function assertClassifierOutputBoundary(output: Record<string, unknown>): void {
  const allowed = new Set(["care_context_state"]);
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) {
      throw new Error(`care context classifier drift — forbidden field: ${key}`);
    }
  }
}
