import { z } from "zod";
import {
  CAREGIVER_DEPLETION_STATES,
  ENVIRONMENTAL_DEPENDENCY_FLAGS,
} from "./contract-constants";

export const CaregiverDepletionSignalsResultSchema = z
  .object({
    caregiver_depletion_state: z.enum(CAREGIVER_DEPLETION_STATES),
    is_single_caregiver: z.boolean(),
    environmental_dependency_flag: z.enum(ENVIRONMENTAL_DEPENDENCY_FLAGS),
  })
  .strict();

export type CaregiverDepletionSignalsResult = z.infer<
  typeof CaregiverDepletionSignalsResultSchema
>;

export function assertClassifierOutputBoundary(output: Record<string, unknown>): void {
  const allowed = new Set([
    "caregiver_depletion_state",
    "is_single_caregiver",
    "environmental_dependency_flag",
  ]);
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) {
      throw new Error(`caregiver depletion classifier drift — forbidden field: ${key}`);
    }
  }
}
