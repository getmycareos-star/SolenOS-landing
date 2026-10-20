import { MVP_MAX_RETRIES } from "../mvp-architecture";

/** Exact retry RULE text — fresh envelope rebuild only, no prior output included. */
export const ANALYZE_RETRY_NOTICE =
  "Return ONLY valid JSON matching the schema exactly. No extra text.";

/** Max Zod/parse failure retries (spec: 2 retries → 3 total attempts). */
export const ANALYZE_MAX_RETRIES = MVP_MAX_RETRIES;

export type AnalyzeFailureReason = "invalid_model_output" | "pipeline_failure";

export type AnalyzeFailureResponse = {
  error: "unable_to_process";
  reason: AnalyzeFailureReason;
};

export function isAnalyzeFailure(
  value: unknown,
): value is AnalyzeFailureResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as AnalyzeFailureResponse).error === "unable_to_process" &&
    ((value as AnalyzeFailureResponse).reason === "invalid_model_output" ||
      (value as AnalyzeFailureResponse).reason === "pipeline_failure")
  );
}

export const ANALYZE_FAILURE: AnalyzeFailureResponse = {
  error: "unable_to_process",
  reason: "invalid_model_output",
};

export const ANALYZE_PIPELINE_FAILURE: AnalyzeFailureResponse = {
  error: "unable_to_process",
  reason: "pipeline_failure",
};
