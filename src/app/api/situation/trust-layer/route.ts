import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { TRUST_LAYER_ENGINE_IDENTITY, processTrustLayerEngine } from "@/lib/trust-layer-engine";
import { processBehaviorInterpretation } from "@/lib/behavior-interpretation-engine";
import { processClarificationEngine } from "@/lib/clarification-engine";
import { processContinuityDecay } from "@/lib/continuity-decay-engine";
import { processMemoryStrategy } from "@/lib/memory-strategy-engine";
import { processTrustProvenance } from "@/lib/trust-provenance";
import { queryPriorityEvents } from "@/lib/care-event-priority";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/trust-layer — epistemic trust block for current context */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);
  const recentEvents = context?.events.slice(-3) ?? [];
  const priorityQuery = queryPriorityEvents(context?.events ?? []);

  const trustProvenance = processTrustProvenance({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    context_events: context?.events ?? [],
    dare: null,
    unresolved_questions: [],
    what_changed: [],
  });

  const behavior = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context?.events ?? [],
    prior_events: context?.events.slice(0, -3) ?? [],
    what_changed: [],
  });

  const continuity_decay = processContinuityDecay({
    caregiver_id: caregiverId,
    all_events: context?.events ?? [],
    events_created: recentEvents,
    what_needs_clarification: [],
    what_is_uncertain: [],
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: [],
    as_of: new Date().toISOString(),
    trigger: "background",
  });

  const memory_strategy = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context?.events ?? [],
  });

  const clarification = processClarificationEngine({
    caregiver_id: caregiverId,
    raw_input: "",
    events_created: recentEvents,
    what_is_uncertain: [],
  });

  const layer = processTrustLayerEngine({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context?.events ?? [],
    what_is_uncertain: [],
    what_needs_clarification: [],
    trust_provenance: trustProvenance,
    behavior,
    continuity_decay,
    memory_strategy,
    clarification,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
  });

  return NextResponse.json({
    identity: TRUST_LAYER_ENGINE_IDENTITY,
    trust_layer_engine_layer: layer,
  });
}
