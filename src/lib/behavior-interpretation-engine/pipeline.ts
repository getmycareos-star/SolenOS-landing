import { BEHAVIOR_PROHIBITED, REASONING_PIPELINE_STAGES } from "./contract-constants";
import { classifyObservedBehaviors, detectBehavioralChange } from "./classify-behavior";
import { assessEscalation } from "./escalation";
import { deriveUnmetNeeds, generateHypotheses } from "./interpret";
import { buildInvestigationChecklist, buildRecommendedApproach } from "./investigation";
import { buildKnowledgeNodes } from "./knowledge-graph";
import { learnLongitudinalPatterns } from "./patterns";
import { matchBehaviorTaxonomy } from "./taxonomy";
import type { BehaviorInterpretationResult, ObservedBehavior, ProcessBehaviorInterpretationInput } from "./types";

function classifyFromSourceSnippets(
  events: ProcessBehaviorInterpretationInput["events_created"],
  situationSnippets: string[] = [],
): ObservedBehavior[] {
  const observed: ObservedBehavior[] = [];
  const anchorEvent = events[events.length - 1];

  for (const event of events) {
    const snippet = event.attributes.source_situation_text;
    if (typeof snippet !== "string") continue;
    for (const entry of matchBehaviorTaxonomy(snippet)) {
      observed.push({
        behavior_id: entry.id,
        label: entry.label,
        group: entry.group,
        source_event_id: event.id,
        observed_at: event.ingestion_time,
        raw_observation: snippet.slice(0, 200),
      });
    }
  }

  if (anchorEvent) {
    for (const snippet of situationSnippets) {
      for (const entry of matchBehaviorTaxonomy(snippet)) {
        observed.push({
          behavior_id: entry.id,
          label: entry.label,
          group: entry.group,
          source_event_id: anchorEvent.id,
          observed_at: anchorEvent.ingestion_time,
          raw_observation: snippet.slice(0, 200),
        });
      }
    }
  }

  return observed;
}

export function shouldTriggerBehaviorEngine(input: ProcessBehaviorInterpretationInput): {
  triggered: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const observed = classifyObservedBehaviors([
    ...input.events_created,
    ...input.all_events.slice(-10),
  ]);

  if (input.events_created.some((e) => classifyObservedBehaviors([e]).length > 0)) {
    reasons.push("New dementia-related behavior CareEvent created");
  }

  if (detectBehavioralChange(observed, input.prior_events)) {
    reasons.push("Behavioral change compared with historical continuity");
  }

  if (input.what_changed.some((c) => /conflict|provisional|uncertainty/i.test(c))) {
    reasons.push("Contradiction or uncertainty in prior interpretations");
  }

  if (observed.length >= 2) {
    reasons.push("Recurring behavioral patterns in recent events");
  }

  return { triggered: reasons.length > 0 || observed.length > 0, reasons };
}

export function processBehaviorInterpretation(
  input: ProcessBehaviorInterpretationInput,
): BehaviorInterpretationResult {
  const { triggered, reasons } = shouldTriggerBehaviorEngine(input);
  const observed = [
    ...classifyObservedBehaviors([
      ...input.events_created,
      ...input.all_events.filter((e) => e.status !== "invalidated" && e.status !== "superseded").slice(-15),
    ]),
    ...classifyFromSourceSnippets(input.events_created, input.situation_snippets),
  ].filter((o, i, arr) => arr.findIndex((x) => x.behavior_id === o.behavior_id && x.source_event_id === o.source_event_id) === i);

  if (observed.length === 0 && input.situation_snippets && input.situation_snippets.length > 0) {
    const anchor = input.all_events[input.all_events.length - 1];
    if (anchor) {
      for (const snippet of input.situation_snippets) {
        for (const entry of matchBehaviorTaxonomy(snippet)) {
          observed.push({
            behavior_id: entry.id,
            label: entry.label,
            group: entry.group,
            source_event_id: anchor.id,
            observed_at: anchor.ingestion_time,
            raw_observation: snippet.slice(0, 200),
          });
        }
      }
    }
  }

  if (!triggered && observed.length === 0) {
    return {
      triggered: false,
      trigger_reasons: [],
      observed_behaviors: [],
      hypotheses: [],
      possible_needs: [],
      investigation_checklist: [],
      recommended_approach: [],
      escalation: {
        escalation_recommended: false,
        triggers: [],
        suggested_actions: [],
        risk_elevation: "none",
      },
      knowledge_nodes: [],
      longitudinal_patterns: [],
      behavioral_change_detected: false,
      contributing_event_ids: [],
      reasoning_stages_completed: [],
      prohibited_avoided: [...BEHAVIOR_PROHIBITED],
      decision_trace_events: [],
      decision_trace_assumptions: [],
      decision_trace_unknowns: [],
    };
  }

  const behavioral_change_detected = detectBehavioralChange(observed, input.prior_events);
  const hypotheses = generateHypotheses(observed);
  const possible_needs = deriveUnmetNeeds(hypotheses);
  const behaviorIds = [...new Set(observed.map((o) => o.behavior_id))];
  const investigation_checklist = buildInvestigationChecklist(behaviorIds);
  const recommended_approach = buildRecommendedApproach(possible_needs);

  const escalation = assessEscalation(
    observed,
    input.all_events.map((e) => e.raw_input),
    behavioral_change_detected,
  );

  const longitudinal_patterns = learnLongitudinalPatterns({
    caregiver_id: input.caregiver_id,
    observed,
    all_events: input.all_events,
  });

  const knowledge_nodes = buildKnowledgeNodes({
    observed,
    hypotheses,
    needs: possible_needs,
    checklist: investigation_checklist,
    recommended: recommended_approach,
    escalation_rules: escalation.triggers,
  });

  const contributing_event_ids = [...new Set(observed.map((o) => o.source_event_id))];

  return {
    triggered: true,
    trigger_reasons: reasons.length > 0 ? reasons : ["Behavioral signals detected in CareEvents"],
    observed_behaviors: observed,
    hypotheses,
    possible_needs,
    investigation_checklist,
    recommended_approach,
    escalation,
    knowledge_nodes,
    longitudinal_patterns,
    behavioral_change_detected,
    contributing_event_ids,
    reasoning_stages_completed: [...REASONING_PIPELINE_STAGES],
    prohibited_avoided: [...BEHAVIOR_PROHIBITED],
    decision_trace_events: observed.map((o) => `CareEvent ${o.source_event_id}: ${o.label} observed`),
    decision_trace_assumptions: hypotheses.map(
      (h) => `${h.interpretation} (${h.confidence} confidence) — ${h.uncertainty_note}`,
    ),
    decision_trace_unknowns: investigation_checklist.slice(0, 5).map((i) => `Unverified: ${i.item}`),
  };
}

export { BEHAVIOR_INTERPRETATION_IDENTITY, BEHAVIOR_ENGINE_BOUNDARY } from "./contract-constants";
