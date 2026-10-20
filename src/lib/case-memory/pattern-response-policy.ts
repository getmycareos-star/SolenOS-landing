import { findSuccessfulIntervention } from "./stores/intervention-outcome-store";
import type {
  Case,
  CaseIntervention,
  ExtractedCaseFacts,
  PatternResponsePolicyResult,
  SelectiveRecallResult,
} from "./types";

/**
 * Pattern Response Policy (PRP) — THE KEY INNOVATION.
 * State A: new event — describe + immediate action; no history
 * State B: weak similarity — light past reference + cautious suggestion
 * State C: strong pattern — intervention mode (compress history → reuse what worked)
 */
export function applyPatternResponsePolicy(params: {
  caseEntity: Case;
  facts: ExtractedCaseFacts;
  recall: SelectiveRecallResult;
}): PatternResponsePolicyResult {
  const { recall, facts, caseEntity } = params;
  const strength = recall.matchStrength;

  let preferredIntervention: CaseIntervention | undefined;

  if (strength === "strong" || strength === "weak") {
    const primaryType = facts.events[0]?.eventType;
    preferredIntervention =
      findSuccessfulIntervention({
        caseId: caseEntity.id,
        eventType: primaryType,
        tags: facts.events.flatMap((e) => e.tags),
      }) ??
      recall.ranked.find((r) => r.event.intervention?.outcome?.success)?.event.intervention ??
      recall.ranked.find((r) => r.event.outcome?.success)?.event.intervention;

    if (!preferredIntervention && caseEntity.understanding.successfulInterventions.length > 0) {
      const label = caseEntity.understanding.successfulInterventions[0]!;
      preferredIntervention = {
        id: "understanding_hint",
        label,
        appliedAt: caseEntity.understanding.updatedAt,
        outcome: {
          success: true,
          summary: "Prior successful intervention from case understanding",
          recordedAt: caseEntity.understanding.updatedAt,
        },
      };
    }
  }

  if (strength === "none" || !recall.shouldRecall) {
    return {
      state: "A",
      matchStrength: "none",
      fieldWeighting: {
        what_is_happening: "present_only",
        what_matters_now: "immediate_action",
        what_to_ask_next: "clarify_present",
        follow_up_items: "present_tasks",
      },
      topEvents: [],
    };
  }

  if (strength === "weak") {
    return {
      state: "B",
      matchStrength: "weak",
      fieldWeighting: {
        what_is_happening: "light_past",
        what_matters_now: "cautious_suggestion",
        what_to_ask_next: "cautious_compare",
        follow_up_items: "light_continuity",
      },
      preferredIntervention,
      topEvents: recall.ranked.slice(0, 2),
    };
  }

  // State C — strong: intervention mode
  return {
    state: "C",
    matchStrength: "strong",
    fieldWeighting: {
      what_is_happening: "minimal_history",
      what_matters_now: "intervention_logic",
      what_to_ask_next: "validate_change",
      follow_up_items: "action_replication",
    },
    preferredIntervention,
    topEvents: recall.ranked.slice(0, 3),
  };
}
