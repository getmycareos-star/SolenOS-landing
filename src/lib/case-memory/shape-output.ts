import type { SolenOSResponse } from "../response-validator";
import { canonicalizeRiskLevel } from "../final-output-contract";
import type { CaseDecisionSnapshot, PatternResponseState } from "./types";

/**
 * Map Case Decision Snapshot (6-field product contract) onto SolenOS display fields (5-field API).
 * follow_up_items stay on case_memory_layer — not folded into SolenOS schema until unified.
 */
export function shapeSolenOSFromDecisionSnapshot(
  response: SolenOSResponse,
  snapshot: CaseDecisionSnapshot,
  patternState: PatternResponseState,
): SolenOSResponse {
  // State A: prefer present-only snapshot text when response would invent history
  if (patternState === "A") {
    return {
      ...response,
      what_is_happening: snapshot.what_is_happening || response.what_is_happening,
      what_matters_now: snapshot.what_matters_now || response.what_matters_now,
      what_to_ask_next: snapshot.what_to_ask_next || response.what_to_ask_next,
      risk_level: mapRisk(snapshot.risk_level, response.risk_level),
      what_can_wait: snapshot.what_can_wait || response.what_can_wait,
    };
  }

  // State B/C: PRP owns weighting — overwrite semantic fields from snapshot
  return {
    ...response,
    what_is_happening: snapshot.what_is_happening,
    what_matters_now: snapshot.what_matters_now,
    what_to_ask_next: snapshot.what_to_ask_next,
    risk_level: mapRisk(snapshot.risk_level, response.risk_level),
    what_can_wait: snapshot.what_can_wait,
  };
}

function mapRisk(
  caseRisk: CaseDecisionSnapshot["risk_level"],
  solenOsRisk: SolenOSResponse["risk_level"],
): SolenOSResponse["risk_level"] {
  if (solenOsRisk === "high") return "high";
  return canonicalizeRiskLevel(caseRisk);
}
