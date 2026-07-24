import { canonicalizeRiskLevel } from "../final-output-contract";
import type { SolenOSOutput } from "../output-contract/types";
import { validateAIResponse } from "../response-validator";
import type {
  Classification,
  DecisionState,
  DomainTag,
  SignalVector,
} from "./types";
import { mapInternalRiskToOutput } from "./decision-engine";

export interface ResponseMappingInput {
  raw: string;
  classification: Classification;
  domain: DomainTag;
  signals: SignalVector;
  decision: DecisionState;
  safe_mode: boolean;
}

function buildSummary(raw: string, signals: SignalVector): string {
  const cleaned = raw.replace(/\s{2,}/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 8 && !s.includes("?"))
    .slice(0, 2);

  let summary = sentences.length > 0 ? sentences.join(" ") : cleaned.slice(0, 280);
  if (signals.emotional_intensity >= 0.5) {
    summary = `It makes sense to feel stressed in situations like this. ${summary}`;
  }
  if (signals.uncertainty_markers.length > 0) {
    summary += " Some details remain unclear.";
  }
  return summary.slice(0, 400) || "A caregiving situation was described.";
}

export function mapResponse(input: ResponseMappingInput): SolenOSOutput {
  const uncertain =
    input.signals.uncertainty_markers.length > 0 ||
    input.classification === "ambiguous" ||
    input.decision.blocking_factor === "missing_baseline";

  const medRisk = input.signals.urgency_signals.length
    ? Math.max(...input.signals.urgency_signals)
    : 0;

  const risk_level = mapInternalRiskToOutput(
    input.decision.risk_level,
    uncertain,
    medRisk,
  );

  const what_can_wait =
    risk_level === "high"
      ? "Insurance, scheduling, and family discussions wait until immediate safety is addressed."
      : uncertain
        ? "Most actions wait until the missing fact above is clarified."
        : "Long-term planning and non-urgent tasks wait until today's priority is complete.";

  return validateAIResponse({
    what_is_happening: buildSummary(input.raw, input.signals),
    what_matters_now: input.decision.primary_action,
    what_to_ask_next:
      input.decision.next_question || "What is the one missing fact right now?",
    risk_level: canonicalizeRiskLevel(risk_level),
    what_can_wait,
  });
}
