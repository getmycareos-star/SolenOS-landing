import type { FinalOutputContract } from "./types";
import type { CrisisModeInteractionResult } from "../crisis-mode-interaction-layer/types";

/** Compress final output into crisis checklist format. */
export function applyCrisisOverlay(
  draft: FinalOutputContract,
  crisis: CrisisModeInteractionResult,
): FinalOutputContract {
  if (!crisis.crisis_mode || !crisis.crisis_output) return draft;

  const co = crisis.crisis_output;

  return {
    what_is_happening: co.immediate_concerns.join(" · "),
    what_matters_now: co.immediate_actions.join(" · "),
    what_to_ask_next: co.monitor.join(" · "),
    risk_level: crisis.urgency_level === "critical" ? "high" : "high",
    what_can_wait: "Long-term analysis, pattern learning, and detailed explanations deferred.",
    follow_up_items: [
      `Clinician: ${co.escalation.clinician}`,
      `Emergency: ${co.escalation.emergency_services}`,
      `Network: ${co.escalation.caregiver_network}`,
      ...co.do_not_do.map((d) => `Avoid: ${d}`),
    ].slice(0, 8),
    decision_trace: {
      events: co.immediate_concerns,
      assumptions: [],
      unknowns: draft.decision_trace.unknowns.slice(0, 2),
      evidence_sources: draft.decision_trace.evidence_sources.slice(0, 2),
    },
    confidence_state: {
      overall_confidence: "medium",
      completeness: draft.confidence_state.completeness,
      reasoning_limits: [
        "Crisis mode — condensed triage output only",
        "No diagnosis or medical certainty implied",
      ],
    },
    trust_layer: {
      ...draft.trust_layer,
      assumed: draft.trust_layer.assumed.slice(0, 2),
      known: draft.trust_layer.known.slice(0, 3),
    },
    transparency_panel: draft.transparency_panel,
  };
}
