import type { SolenOSResponse } from "../response-validator";
import { validateAIResponse } from "../response-validator";

export const VERIFY_PROMPT_REGRESSION_GOLDENS: Readonly<Record<string, SolenOSResponse>> = {
  "Mom missed her evening medication.": validateAIResponse({
    what_is_happening:
      "The caregiver reports that evening medication was missed, which creates uncertainty about whether today's dose schedule is intact.",
    what_matters_now:
      "Confirm whether the missed evening dose was taken because medication timing affects safety and next-step decisions.",
    what_to_ask_next: "Did she take the evening dose?",
    risk_level: "medium",
    what_can_wait:
      "Insurance calls and scheduling can wait until medication status is confirmed.",
    follow_up_items: ["Confirm medication status"],
    decision_trace: {
      events: [],
      assumptions: [],
      unknowns: [],
      evidence_sources: [],
    },
    confidence_state: {
      overall_confidence: "low",
      completeness: 0,
      reasoning_limits: ["Insufficient structured information to interpret safely."],
    },
    trust_layer: {
      known: [],
      assumed: [],
      unknown: [{ statement: "Insufficient structure to surface explicit gaps", drives_clarification: true }],
      recency: { last_updated_at: null, freshness_score: 0, interpretation: "potentially outdated (>7–14 days)" },
      confidence: 0.15,
    },
    transparency_panel: {
      data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
      data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
      reason_for_output: "Awaiting structured care input to produce traceable reasoning.",
      evidence_breakdown: [],
      confidence_scores: { overall_pct: 15, tier: "low" },
      recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
      observed: [],
      inferred: [],
    },
  }),
};

export function checkPromptRegressionWithGoldens(
  normalizedInput: string,
  output: SolenOSResponse,
  goldens: Readonly<Record<string, SolenOSResponse>>,
): import("./types").PromptRegressionCheckResult {
  const golden = goldens[normalizedInput.trim()];
  if (!golden) {
    return { ok: true, skipped: true };
  }

  const { canonicalizeOutput } = require("./canonicalize") as typeof import("./canonicalize");
  if (canonicalizeOutput(output) !== canonicalizeOutput(golden)) {
    return { ok: false, failure_type: "PROMPT_REGRESSION_FAILURE" };
  }

  return { ok: true, skipped: false };
}
