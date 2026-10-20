import { z } from "zod";

export const HumanValidationSignalSchema = z
  .object({
    response_id: z.string().min(1),
    helpful: z.boolean(),
    reduced_confusion: z.boolean().nullable(),
    timestamp: z.string(),
  })
  .strict();

export type HumanValidationSignal = z.infer<typeof HumanValidationSignalSchema>;

export const HumanValidationSubmitSchema = z
  .object({
    response_id: z.string().min(1),
    helpful: z.boolean(),
    reduced_confusion: z.boolean().nullable().optional(),
  })
  .strict();

export type HumanValidationSubmit = z.infer<typeof HumanValidationSubmitSchema>;
