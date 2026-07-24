import {
  RISK_UNCERTAINTY_BOUNDARY,
  RISK_UNCERTAINTY_IDENTITY,
} from "./contract-constants";
import { checkInformationCompleteness } from "./completeness-check";
import { runDecisionGate } from "./decision-gate";
import { extractFactsOnly } from "./extract-facts";
import {
  buildBlockedSolenOSResponse,
  buildRiskUncertaintyOutput,
  enforceOutputSafety,
} from "./build-output";
import { classifyPriority } from "./risk-classification";
import type {
  ProcessRiskUncertaintyResult,
  RiskUncertaintyLayerPayload,
} from "./types";
import type { SolenOSResponse } from "../response-validator";

/**
 * Mandatory Risk & Uncertainty pipeline — hard order, do not reorder.
 */
export function processRiskUncertainty(input: string): ProcessRiskUncertaintyResult {
  const facts = extractFactsOnly(input);
  const completeness = checkInformationCompleteness(input);
  const gate = runDecisionGate(completeness.status);
  const classification = classifyPriority(completeness.status, input);

  const output = buildRiskUncertaintyOutput({
    facts,
    completeness,
    blocked: gate.blocked,
    priority: classification.priority,
    confidence: classification.confidence,
  });

  return {
    output,
    blocked: gate.blocked,
    solenOSOverride: gate.blocked,
  };
}

export function toRiskUncertaintyLayerPayload(
  result: ProcessRiskUncertaintyResult,
): RiskUncertaintyLayerPayload {
  return {
    identity: RISK_UNCERTAINTY_IDENTITY,
    boundary: RISK_UNCERTAINTY_BOUNDARY,
    output: result.output,
    pipeline_step: result.blocked ? "blocked_at_gate" : "classified",
  };
}

export function buildGateBlockedResponse(input: string): {
  result: SolenOSResponse;
  layer: RiskUncertaintyLayerPayload;
} {
  const processed = processRiskUncertainty(input);
  return {
    result: buildBlockedSolenOSResponse(processed.output),
    layer: toRiskUncertaintyLayerPayload(processed),
  };
}

export function applyRiskUncertaintyToResponse(
  response: SolenOSResponse,
  layer: RiskUncertaintyLayerPayload,
): SolenOSResponse {
  return enforceOutputSafety(response, layer.output);
}
