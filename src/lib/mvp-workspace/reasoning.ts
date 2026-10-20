import type { HumanTrustLayerPayload } from "@/lib/human-trust-layer/types";
import type { DeterministicPrioritizationLayerPayload } from "@/lib/deterministic-prioritization/types";
import type { CaregiverLoadEngineLayerPayload } from "@/lib/caregiver-load-engine/types";
import type { LoadInterpretationLayerPayload } from "@/lib/load-interpretation/types";
import type { RiskUncertaintyLayerPayload } from "@/lib/risk-uncertainty-engine/types";
import type { CareJourneyGraphLayerPayload } from "@/lib/care-journey-graph/types";

/** Layer payloads surfaced in CLARITY "Why SolenOS says this" — not chat. */
export type MvpReasoningContext = {
  humanTrust: HumanTrustLayerPayload | null;
  deterministicPriority: DeterministicPrioritizationLayerPayload | null;
  caregiverLoadEngine: CaregiverLoadEngineLayerPayload | null;
  loadInterpretation: LoadInterpretationLayerPayload | null;
  riskUncertainty: RiskUncertaintyLayerPayload | null;
  careJourneyGraph: CareJourneyGraphLayerPayload | null;
};

export function extractMvpReasoning(raw: Record<string, unknown>): MvpReasoningContext {
  return {
    humanTrust: (raw.human_trust_layer as HumanTrustLayerPayload | undefined) ?? null,
    deterministicPriority:
      (raw.deterministic_priority_layer as DeterministicPrioritizationLayerPayload | undefined) ??
      null,
    caregiverLoadEngine:
      (raw.caregiver_load_engine as CaregiverLoadEngineLayerPayload | undefined) ?? null,
    loadInterpretation:
      (raw.load_interpretation_layer as LoadInterpretationLayerPayload | undefined) ?? null,
    riskUncertainty:
      (raw.risk_uncertainty_layer as RiskUncertaintyLayerPayload | undefined) ?? null,
    careJourneyGraph:
      (raw.care_journey_graph_layer as CareJourneyGraphLayerPayload | undefined) ?? null,
  };
}