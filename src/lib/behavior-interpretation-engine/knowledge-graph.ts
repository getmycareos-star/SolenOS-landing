import type { BehaviorKnowledgeNode, BehaviorHypothesis, InvestigationItem, ObservedBehavior, UnmetNeed } from "./types";

export function buildKnowledgeNodes(input: {
  observed: ObservedBehavior[];
  hypotheses: BehaviorHypothesis[];
  needs: UnmetNeed[];
  checklist: InvestigationItem[];
  recommended: string[];
  escalation_rules: string[];
}): BehaviorKnowledgeNode[] {
  const byBehavior = new Map<string, BehaviorKnowledgeNode>();

  for (const behavior of input.observed) {
    const node: BehaviorKnowledgeNode = {
      behavior_id: behavior.behavior_id,
      label: behavior.label,
      interpretations: input.hypotheses.filter((h) =>
        h.supporting_event_ids.includes(behavior.source_event_id),
      ),
      possible_needs: input.needs,
      investigation_checklist: input.checklist,
      recommended_responses: input.recommended,
      escalation_rules: input.escalation_rules,
      observed_outcome_event_ids: [behavior.source_event_id],
    };
    byBehavior.set(behavior.behavior_id, node);
  }

  return [...byBehavior.values()];
}
