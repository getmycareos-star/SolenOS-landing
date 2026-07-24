import type { BehaviorInterpretationResult } from "../behavior-interpretation-engine/types";
import type { TrustAssumedItem } from "./types";

export function buildAssumedInferences(
  behavior: BehaviorInterpretationResult,
): TrustAssumedItem[] {
  const assumed: TrustAssumedItem[] = [];

  for (const hypothesis of behavior.hypotheses) {
    assumed.push({
      statement: hypothesis.interpretation,
      reasoning_basis:
        hypothesis.supporting_event_ids.length > 0
          ? `Supported by ${hypothesis.supporting_event_ids.length} observed event(s)`
          : hypothesis.uncertainty_note || "Observed behavioral pattern",
      source_engine: "behavior_interpretation_engine",
    });
  }

  for (const need of behavior.possible_needs.slice(0, 3)) {
    assumed.push({
      statement: `Possible unmet need: ${need.replace(/_/g, " ")}`,
      reasoning_basis: "Interpretive need — not confirmed fact",
      source_engine: "behavior_interpretation_engine",
    });
  }

  for (const assumption of behavior.decision_trace_assumptions.slice(0, 3)) {
    assumed.push({
      statement: assumption,
      reasoning_basis: "Working interpretation during reasoning",
      source_engine: "behavior_interpretation_engine",
    });
  }

  const seen = new Set<string>();
  return assumed.filter((a) => {
    const key = a.statement.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
