import fs from "node:fs";
import path from "node:path";

import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import { processCareJourneyInput } from "../care-journey-graph/pipeline";
import { checkInformationCompleteness } from "../risk-uncertainty-engine/completeness-check";
import { runDecisionGate } from "../risk-uncertainty-engine/decision-gate";
import {
  CARE_CONTINUITY_MVP_PILLARS,
  CARE_CONTINUITY_SYSTEM_GOAL,
  PILLAR_MODULES,
} from "./contract-constants";
import { journeyEventToContinuityEvent, type CareContinuitySystemStatus } from "./types";

export type ProcessCareContinuityInputParams = {
  description: string;
  caregiver_id?: string;
  case_id?: string | null;
  source?: string;
  timestamp?: string;
  attachments?: { id: string; name: string; mime_type?: string }[];
};

export type CareContinuityInputResult = {
  event: ReturnType<typeof journeyEventToContinuityEvent>;
  completeness_status: "COMPLETE" | "PARTIALLY_COMPLETE" | "INSUFFICIENT";
  reasoning_blocked: boolean;
  open_questions: string[];
  relationship_count: number;
};

/**
 * Unified Care Continuity input pipeline — the core product path.
 *
 * Completeness check → Journey event → Relationships → Continuity
 * (Uncertainty gate runs before any risk/urgency in analyze pipeline.)
 */
export function processCareContinuityInput(
  params: ProcessCareContinuityInputParams,
): CareContinuityInputResult {
  const completeness = checkInformationCompleteness(params.description);
  const gate = runDecisionGate(completeness.status);

  const journeyResult = processCareJourneyInput({
    description: params.description,
    caregiver_id: params.caregiver_id,
    case_id: params.case_id,
    source: params.source,
    timestamp: params.timestamp,
    attachments: params.attachments,
  });

  return {
    event: journeyEventToContinuityEvent(journeyResult.event),
    completeness_status: completeness.status,
    reasoning_blocked: gate.blocked,
    open_questions: completeness.missing_signals.map((m) => `Can you clarify: ${m}?`),
    relationship_count: journeyResult.new_relationships.length,
  };
}

export function getCareContinuitySystemStatus(
  caregiverId: string,
  caseId: string | null = null,
  rootDir = process.cwd(),
): CareContinuitySystemStatus {
  const graph = getGraphForCaregiver(caregiverId, caseId);
  const events = graph?.events ?? [];
  const relationships = graph?.relationships ?? [];

  const pillars: Record<string, boolean> = {};
  for (const pillar of CARE_CONTINUITY_MVP_PILLARS) {
    const modulePath = PILLAR_MODULES[pillar];
    pillars[pillar] = fs.existsSync(path.join(rootDir, modulePath));
  }

  const openQuestions = events.flatMap((e) => e.open_questions).filter(Boolean);

  return {
    identity: CARE_CONTINUITY_SYSTEM_GOAL,
    journey_event_count: events.length,
    relationship_count: relationships.length,
    open_questions_count: openQuestions.length,
    pillars,
    all_pillars_present: Object.values(pillars).every(Boolean),
  };
}

export function listCareContinuityEvents(
  caregiverId: string,
  caseId: string | null = null,
) {
  const graph = getGraphForCaregiver(caregiverId, caseId);
  return (graph?.events ?? []).map(journeyEventToContinuityEvent);
}
