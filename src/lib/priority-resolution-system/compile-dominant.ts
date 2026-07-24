import type { SituationResponse } from "../situation-entry/types";
import type { FinalOutputContract } from "../final-output-contract/types";
import {
  compileFromSituationResponse,
  enforceFinalOutputAtBoundary,
} from "../final-output-contract";
import { compileFromSessionReentry, compileFromAdoptionWedge } from "../final-output-contract/entry-compile";
import { compileFromReturnStateOfCare } from "../retention-engine";
import { applyCrisisOverlay } from "../final-output-contract/crisis-overlay";
import {
  createEmptyTrustLayer,
  createEmptyConfidenceState,
  createEmptyTransparencyPanel,
  buildDegradedOutput,
} from "../final-output-contract/degrade";
import { validateFinalOutput } from "../final-output-contract/schema";
import type { PriorityResolutionResult } from "../priority-resolution-system";
import type { EdgeStateResult } from "../edge-state-machine";

type CompileSource = Omit<SituationResponse, "final_output">;

/**
 * Single-mode compile gate — only the dominant priority mode produces final output.
 * Edge-state restrictions compress the result.
 */
export function compileByDominantMode(input: {
  response: CompileSource;
  priority: PriorityResolutionResult;
  edge_state: EdgeStateResult;
}): FinalOutputContract {
  const { response, priority, edge_state } = input;
  let draft: FinalOutputContract;

  switch (priority.dominant_mode) {
    case "crisis_mode": {
      const base = compileFromSituationResponse(response);
      draft =
        response.crisis_mode_interaction_layer?.crisis_mode
          ? applyCrisisOverlay(base, response.crisis_mode_interaction_layer)
          : base;
      break;
    }
    case "first_60s_value_loop": {
      // Prefer structured understanding from CareEvents — first value is continuity, not onboarding copy.
      if (response.events_created.length > 0) {
        const fromSoc =
          response.state_of_care_summary_layer?.active
            ? compileFromSessionReentry(response)
            : null;
        draft = fromSoc ?? compileFromSituationResponse(response);
      } else if (response.adoption_wedge_layer?.active && !response.adoption_wedge_layer.ingestion_ready) {
        draft = compileFromAdoptionWedge(response.adoption_wedge_layer);
      } else if (response.adoption_wedge_layer?.active) {
        draft = compileFromAdoptionWedge(response.adoption_wedge_layer);
      } else {
        draft = compileFromSituationResponse(response);
      }
      break;
    }
    case "return_value_loop": {
      if (response.retention_engine_layer?.return_state) {
        draft = compileFromReturnStateOfCare(
          response.retention_engine_layer.return_state,
          response.trust_layer_engine_layer?.trust_layer ?? createEmptyTrustLayer(),
          {
            overall_confidence:
              (response.continuity_decay_layer?.continuity_confidence_pct ?? 50) >= 70
                ? "medium"
                : "low",
            completeness: response.continuity_decay_layer?.continuity_confidence_pct ?? 50,
            reasoning_limits: [
              "Return State of Care — dominant mode via Priority Resolution",
            ],
          },
          createEmptyTransparencyPanel(),
        );
      } else {
        draft = compileFromSessionReentry(response) ?? compileFromSituationResponse(response);
      }
      break;
    }
    case "clarification_mode": {
      const q =
        response.what_needs_clarification[0] ??
        response.clarification_engine_layer?.questions[0]?.question ??
        "What is the single most important missing detail right now?";
      draft = validateFinalOutput({
        what_is_happening: "Insufficient data for reliable care-state inference",
        what_matters_now: q,
        what_to_ask_next: q,
        risk_level: "low",
        what_can_wait: "Broader timeline and secondary tracking",
        follow_up_items: [q],
        decision_trace: {
          events: [],
          assumptions: [],
          unknowns: response.what_is_uncertain.slice(0, 3),
          evidence_sources: ["clarification_engine"],
        },
        confidence_state: createEmptyConfidenceState(),
        trust_layer: createEmptyTrustLayer(),
        transparency_panel: createEmptyTransparencyPanel(),
      });
      break;
    }
    case "state_of_care_summary":
    default: {
      const diff = response.care_context_diff_layer;
      if (diff?.has_meaningful_change) {
        const sections = diff.diff.sections;
        const changed = [
          ...sections.factual_delta,
          ...sections.directional_change,
          ...sections.newly_important,
        ].slice(0, 5);
        const fromSoc = compileFromSessionReentry(response);
        const base = fromSoc ?? compileFromSituationResponse(response);
        draft = validateFinalOutput({
          ...base,
          what_is_happening:
            changed.join(" · ") || base.what_is_happening,
          what_matters_now:
            sections.newly_important[0] ??
            sections.directional_change[0] ??
            base.what_matters_now,
          decision_trace: {
            ...base.decision_trace,
            events: changed.length > 0 ? changed : base.decision_trace.events,
            evidence_sources: [
              ...new Set([...base.decision_trace.evidence_sources, "care_context_diff"]),
            ],
          },
        });
      } else {
        const fromSoc = compileFromSessionReentry(response);
        draft = fromSoc ?? compileFromSituationResponse(response);
      }
      break;
    }
  }

  return applyEdgeRestrictions(draft, edge_state);
}

function applyEdgeRestrictions(
  draft: FinalOutputContract,
  edge: EdgeStateResult,
): FinalOutputContract {
  const r = edge.output_restrictions;
  let next = { ...draft };

  if (edge.banner_message) {
    next = {
      ...next,
      confidence_state: {
        ...next.confidence_state,
        reasoning_limits: [
          edge.banner_message,
          ...next.confidence_state.reasoning_limits.slice(0, 4),
        ],
      },
    };
  }

  if (!r.allow_strong_conclusions) {
    next = {
      ...next,
      confidence_state: {
        ...next.confidence_state,
        overall_confidence: "low",
        reasoning_limits: [
          `Edge state: ${edge.edge_state} — strong conclusions blocked`,
          ...next.confidence_state.reasoning_limits.slice(0, 3),
        ],
      },
    };
  }

  if (r.must_label_uncertainty && next.decision_trace.unknowns.length === 0) {
    next = {
      ...next,
      decision_trace: {
        ...next.decision_trace,
        unknowns: ["Operational uncertainty declared by edge-state machine"],
      },
    };
  }

  if (r.require_conflict_surface) {
    next = {
      ...next,
      what_is_happening: `Conflicting reports detected. ${next.what_is_happening}`,
      what_matters_now: `Do not force resolution — ${next.what_matters_now}`,
    };
  }

  if (r.action_first) {
    next = {
      ...next,
      follow_up_items: next.follow_up_items.slice(0, r.max_actions),
      what_can_wait: "Secondary explanation deferred during crisis/edge action-first mode",
    };
  } else {
    next = {
      ...next,
      follow_up_items: next.follow_up_items.slice(0, Math.max(r.max_actions, 1)),
    };
  }

  if (edge.edge_state === "bootstrap" && !draft.what_is_happening.trim()) {
    return buildDegradedOutput({
      reason: edge.classification_reason,
      questions: [next.what_to_ask_next],
      unknowns: next.decision_trace.unknowns,
    });
  }

  return validateFinalOutput(next);
}

export function enforceCompiledDominantOutput(
  response: CompileSource,
  priority: PriorityResolutionResult,
  edge: EdgeStateResult,
): {
  final_output: FinalOutputContract;
  architectural_boundaries_layer: SituationResponse["architectural_boundaries_layer"];
} {
  const draft = compileByDominantMode({ response, priority, edge_state: edge });
  return enforceFinalOutputAtBoundary(draft, response as SituationResponse);
}
