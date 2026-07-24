import { z } from "zod";
import { INPUT_MODES } from "./contract-constants";

export const InputClassificationResultSchema = z
  .object({
    mode: z.enum(INPUT_MODES),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export type InputClassificationResult = z.infer<typeof InputClassificationResultSchema>;

export function assertClassifierOutputBoundary(output: Record<string, unknown>): void {
  const allowed = new Set(["mode", "confidence"]);
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) {
      throw new Error(`classifier output drift — forbidden field: ${key}`);
    }
  }
}
