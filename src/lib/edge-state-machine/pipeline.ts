import {
  DEGRADED_MIN_EVENTS,
  EDGE_STATE_DEFINING_PRINCIPLE,
  EDGE_STATE_RULES,
  STALE_THRESHOLD_DAYS,
} from "./contract-constants";
import type {
  EdgeState,
  EdgeStateResult,
  EngineActivation,
  OutputRestrictions,
  ProcessEdgeStateInput,
} from "./types";

const FULL_ACTIVATION: EngineActivation = {
  care_event_engine: true,
  timeline_engine: true,
  contradiction_engine: true,
  diff_engine: true,
  prioritization_engine: true,
  trust_layer: true,
  pattern_engine: true,
  continuity_decay_engine: true,
};

function activationFor(state: EdgeState): EngineActivation {
  switch (state) {
    case "crisis":
      return {
        care_event_engine: true,
        timeline_engine: false,
        contradiction_engine: false,
        diff_engine: false,
        prioritization_engine: true,
        trust_layer: false,
        pattern_engine: false,
        continuity_decay_engine: false,
      };
    case "bootstrap":
      return {
        care_event_engine: true,
        timeline_engine: false,
        contradiction_engine: false,
        diff_engine: false,
        prioritization_engine: false,
        trust_layer: false,
        pattern_engine: false,
        continuity_decay_engine: false,
      };
    case "conflict":
      return {
        ...FULL_ACTIVATION,
        prioritization_engine: false,
        pattern_engine: false,
      };
    case "stale":
      return {
        ...FULL_ACTIVATION,
        pattern_engine: false,
        continuity_decay_engine: true,
      };
    case "degraded":
      return {
        ...FULL_ACTIVATION,
        pattern_engine: false,
      };
    default:
      return { ...FULL_ACTIVATION };
  }
}

function restrictionsFor(state: EdgeState): OutputRestrictions {
  switch (state) {
    case "crisis":
      return {
        max_insights: 0,
        max_actions: 3,
        max_clarification_questions: 0,
        allow_strong_conclusions: false,
        allow_historical_claims: false,
        must_label_uncertainty: true,
        require_conflict_surface: false,
        action_first: true,
      };
    case "bootstrap":
      return {
        max_insights: 2,
        max_actions: 2,
        max_clarification_questions: 1,
        allow_strong_conclusions: false,
        allow_historical_claims: false,
        must_label_uncertainty: true,
        require_conflict_surface: false,
        action_first: false,
      };
    case "degraded":
      return {
        max_insights: 3,
        max_actions: 2,
        max_clarification_questions: 1,
        allow_strong_conclusions: false,
        allow_historical_claims: true,
        must_label_uncertainty: true,
        require_conflict_surface: false,
        action_first: false,
      };
    case "stale":
      return {
        max_insights: 2,
        max_actions: 2,
        max_clarification_questions: 1,
        allow_strong_conclusions: false,
        allow_historical_claims: false,
        must_label_uncertainty: true,
        require_conflict_surface: false,
        action_first: false,
      };
    case "conflict":
      return {
        max_insights: 3,
        max_actions: 1,
        max_clarification_questions: 1,
        allow_strong_conclusions: false,
        allow_historical_claims: true,
        must_label_uncertainty: true,
        require_conflict_surface: true,
        action_first: false,
      };
    default:
      return {
        max_insights: 5,
        max_actions: 5,
        max_clarification_questions: 2,
        allow_strong_conclusions: true,
        allow_historical_claims: true,
        must_label_uncertainty: true,
        require_conflict_surface: false,
        action_first: false,
      };
  }
}

function bannerFor(state: EdgeState, input: ProcessEdgeStateInput): string | null {
  switch (state) {
    case "crisis":
      return "Crisis mode — action-first triage";
    case "conflict":
      return "Conflicting reports detected — both viewpoints preserved";
    case "stale":
      return input.days_since_last_event != null
        ? `Last update ${Math.round(input.days_since_last_event)} days ago — current state may be outdated`
        : "No recent updates — current state may be outdated";
    case "degraded":
      return "Limited data available — showing partial care state only";
    case "bootstrap":
      return "Care record not yet established — awaiting first structured input";
    default:
      return null;
  }
}

export function classifyEdgeState(input: ProcessEdgeStateInput): EdgeStateResult {
  let edge_state: EdgeState = "normal";
  let classification_reason = "Adequate context and continuity";

  if (input.crisis_detected) {
    edge_state = "crisis";
    classification_reason = "Safety or medical urgency signals active";
  } else if (input.unresolved_contradictions > 0) {
    edge_state = "conflict";
    classification_reason = `${input.unresolved_contradictions} unresolved contradiction(s)`;
  } else if (
    input.days_since_last_event != null &&
    input.days_since_last_event >= STALE_THRESHOLD_DAYS
  ) {
    edge_state = "stale";
    classification_reason = `No CareEvents for ${Math.round(input.days_since_last_event)} days`;
  } else if (
    input.continuity_decay_pct != null &&
    input.continuity_decay_pct < 40
  ) {
    edge_state = "stale";
    classification_reason = `Continuity confidence at ${input.continuity_decay_pct}%`;
  } else if (input.event_count === 0) {
    edge_state = "bootstrap";
    classification_reason = "Empty event store for care recipient";
  } else if (
    input.event_count < DEGRADED_MIN_EVENTS ||
    input.missing_critical_fields >= 2 ||
    input.low_confidence_aggregate
  ) {
    edge_state = "degraded";
    classification_reason = "Sparse CareEvents or incomplete critical fields";
  }

  return {
    active: true,
    edge_state,
    classification_reason,
    engine_activation: activationFor(edge_state),
    output_restrictions: restrictionsFor(edge_state),
    banner_message: bannerFor(edge_state, input),
    rules_upheld: [...EDGE_STATE_RULES],
    defining_principle: EDGE_STATE_DEFINING_PRINCIPLE,
  };
}

export function processEdgeState(input: ProcessEdgeStateInput): EdgeStateResult {
  return classifyEdgeState(input);
}
