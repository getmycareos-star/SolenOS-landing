import { z } from "zod";
import { SOLENOS_LANGUAGES } from "../multilingual-execution";

export const AnalyzeRequestSchema = z.object({
  input: z.string(),
  source_type: z.enum(["text", "document"]),
  telemetry_user_id: z.string().uuid().optional(),
  care_session_id: z.string().uuid().optional(),
  prior_input_raw: z.string().optional(),
  resume_context: z.boolean().optional(),
  language_preference: z.enum(SOLENOS_LANGUAGES).optional(),
  governance_settings: z.record(z.string(), z.unknown()).optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/**
 * Step 1 — Input normalization only. No interpretation or semantic processing.
 */
export function normalizeAnalyzeInput(input: string): string {
  return input
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function parseAnalyzeRequest(body: unknown): AnalyzeRequest {
  return AnalyzeRequestSchema.parse(body);
}
