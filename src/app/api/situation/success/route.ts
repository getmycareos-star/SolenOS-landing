import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCareContextRoot } from "@/lib/situation-entry";
import { buildContinuityLinks } from "@/lib/care-memory-layers/layer-continuity";
import { processMemoryLayers, estimateContextWindowSize } from "@/lib/care-memory-layers";
import { queryPriorityEvents } from "@/lib/care-event-priority";
import { processFailureResilience } from "@/lib/failure-resilience";
import { processNetworkEffectMoat } from "@/lib/network-effect-moat";
import { processTrustProvenance } from "@/lib/trust-provenance";
import {
  evaluateFeatureAcceptance,
  getLatestSnapshot,
  getSnapshotHistory,
  processSuccessModel,
  SUCCESS_MODEL_IDENTITY,
} from "@/lib/success-model";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/success — outcome success metrics */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const featureName = req.nextUrl.searchParams.get("feature_name");

  const context = getCareContextRoot(caregiverId);
  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: SUCCESS_MODEL_IDENTITY,
      overall_success_score: 0,
      overall_level: "insufficient",
      outcome_summary: "Add structured situations to begin measuring outcome success.",
      history: [],
    });
  }

  const memory = processMemoryLayers({
    caregiver_id: caregiverId,
    events: context.events,
  });

  const priorityQuery = queryPriorityEvents(context.events);
  const failure = processFailureResilience({
    caregiver_id: caregiverId,
    dare: null,
    events_created: [],
    prior_events: context.events,
    raw_input: "",
  });

  const trust = processTrustProvenance({
    caregiver_id: caregiverId,
    events_created: [],
    context_events: context.events,
    dare: null,
    unresolved_questions: memory.retrieval.unresolved_questions,
    what_changed: [],
  });

  const moat = processNetworkEffectMoat({
    caregiver_id: caregiverId,
    new_events: [],
    prior_events: context.events,
    all_events: context.events,
    unresolved_questions: memory.retrieval.unresolved_questions,
    what_changed: [],
    dare: null,
    prior_link_count: memory.store.structured.links.length,
  });

  const success = processSuccessModel({
    caregiver_id: caregiverId,
    events: context.events,
    events_created: [],
    what_changed: [],
    unresolved_questions: memory.retrieval.unresolved_questions,
    dare: null,
    failure,
    trust,
    moat,
    top_event_ids: priorityQuery.top_events.map((e) => e.id),
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    context_window_chars: estimateContextWindowSize(memory.context_window),
    has_active_episode: memory.store.active_episode_id !== null,
  });

  const links = buildContinuityLinks(context.events);

  let feature_acceptance = null;
  if (featureName) {
    const answersParam = req.nextUrl.searchParams.get("answers");
    const answers = answersParam
      ? answersParam.split(",").map((a) => a.trim() === "yes")
      : [];
    feature_acceptance = evaluateFeatureAcceptance(featureName, answers);
  }

  return NextResponse.json({
    identity: SUCCESS_MODEL_IDENTITY,
    ...success,
    latest_snapshot: getLatestSnapshot(caregiverId),
    history: getSnapshotHistory(caregiverId).slice(-10),
    continuity_links: links.length,
    feature_acceptance,
  });
}
