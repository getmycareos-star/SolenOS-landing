import {
  MVP_FIRST_SCREEN_PROMPT,
  MVP_NON_GOALS,
  POST_ENTRY_SYSTEM_DEFINITION,
} from "./contract-constants";
import { buildAhaMomentView } from "./aha-moment";
import { buildContinuityHomeView, buildPostEntryBehavior } from "./continuity-home";
import { recordMvpVisit } from "./store";
import type { MvpSurfaceAreaLayer, ProcessMvpSurfaceInput, PrioritySurfaceItem } from "./types";

export function resolveMvpSystemState(
  hasContextRoot: boolean,
  eventCount: number,
): MvpSurfaceAreaLayer["system_state"] {
  if (!hasContextRoot || eventCount === 0) return "empty";
  return "active_continuity";
}

function evaluateSuccessCriteria(
  input: ProcessMvpSurfaceInput,
): MvpSurfaceAreaLayer["success_criteria"] {
  const r = input.response;
  const eventCount = r.context.events.length;
  const hasStructure = r.what_i_understood.length > 0 || r.events_created.length > 0;
  const hasUncertaintySurface =
    r.what_is_uncertain.length > 0 ||
    r.what_needs_clarification.length > 0 ||
    hasStructure;

  return {
    capture_situation_under_one_minute: true,
    structured_continuity_visible: hasStructure,
    known_and_unknown_explicit: hasUncertaintySurface,
    return_context_regained: eventCount >= 1 && input.is_return_session === true,
    frictionless_ongoing_capture: eventCount >= 1,
  };
}

export function processMvpSurfaceArea(input: ProcessMvpSurfaceInput): MvpSurfaceAreaLayer {
  const eventCount = input.response.context.events.length;
  const hasContextRoot = eventCount > 0;
  const systemState = resolveMvpSystemState(hasContextRoot, eventCount);
  const attentionIds = input.response.priority_layer?.attention_events ?? [];
  const topIds = input.response.priority_layer?.top_events ?? [];
  const priorityIds = [...new Set([...attentionIds, ...topIds])];

  const unresolved = [
    ...input.response.what_needs_clarification,
    ...input.response.what_is_uncertain,
  ];

  const ahaMoment =
    input.response.events_created.length > 0 || input.response.is_first_situation
      ? buildAhaMomentView(input.response)
      : null;

  const openFollowUpCount =
    input.response.network_effect_moat_layer?.compounding_metrics.open_follow_ups ?? 0;
  const pendingFollowUps = [
    ...input.response.what_needs_clarification,
    ...(input.response.continuity_decay_layer?.recheck_prompts ?? []),
    ...(openFollowUpCount > 0
      ? [`${openFollowUpCount} open follow-up${openFollowUpCount === 1 ? "" : "s"} tracked in care context`]
      : []),
  ];

  const continuityHome =
    systemState === "active_continuity"
      ? buildContinuityHomeView({
          caregiver_id: input.caregiver_id,
          response: input.response,
          attention_event_ids: priorityIds,
          pending_follow_ups: pendingFollowUps,
        })
      : null;

  const postEntry =
    systemState === "active_continuity"
      ? buildPostEntryBehavior(input.response)
      : null;

  const prioritySurface: PrioritySurfaceItem[] = [];
  if (attentionIds.length > 0) {
    prioritySurface.push({
      kind: "urgency_changes",
      label: "Urgency changes",
      event_ids: attentionIds,
    });
  }
  if (input.response.what_is_uncertain.length > 0) {
    prioritySurface.push({
      kind: "increasing_uncertainty",
      label: "Increasing uncertainty",
      event_ids: [],
    });
  }
  if (input.response.events_created.length > 0) {
    prioritySurface.push({
      kind: "newly_added_events",
      label: "Newly added events",
      event_ids: input.response.events_created.map((e) => e.id),
    });
  }
  if (input.response.what_needs_clarification.length > 0) {
    prioritySurface.push({
      kind: "unresolved_critical_questions",
      label: "Unresolved critical questions",
      event_ids: [],
    });
  }
  if (openFollowUpCount > 0) {
    prioritySurface.push({
      kind: "time_sensitive_follow_ups",
      label: "Time-sensitive follow-ups",
      event_ids: [],
    });
  }

  recordMvpVisit(input.caregiver_id, eventCount, unresolved);

  return {
    system_state: systemState,
    first_screen_prompt: MVP_FIRST_SCREEN_PROMPT,
    aha_moment: ahaMoment,
    continuity_home: continuityHome,
    post_entry: postEntry,
    priority_surface: prioritySurface,
    success_criteria: evaluateSuccessCriteria(input),
    non_goals_suppressed: [...MVP_NON_GOALS],
    post_entry_definition: POST_ENTRY_SYSTEM_DEFINITION,
  };
}

export { MVP_SURFACE_IDENTITY, MVP_CORE_THESIS, MVP_NON_GOALS } from "./contract-constants";
