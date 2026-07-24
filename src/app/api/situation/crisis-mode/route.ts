import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { CRISIS_MODE_IDENTITY, processCrisisModeInteraction } from "@/lib/crisis-mode-interaction-layer";
import { processBehaviorInterpretation } from "@/lib/behavior-interpretation-engine";
import { queryPriorityEvents } from "@/lib/care-event-priority";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/crisis-mode — crisis interaction state */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const rawInput = req.nextUrl.searchParams.get("raw_input") ?? "";
  const context = getCareContextRoot(caregiverId);
  const recentEvents = context?.events.slice(-3) ?? [];
  const priorityQuery = queryPriorityEvents(context?.events ?? []);

  const behavior = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context?.events ?? [],
    prior_events: context?.events.slice(0, -3) ?? [],
    what_changed: [],
    situation_snippets: rawInput.trim() ? [rawInput.trim()] : [],
  });

  const layer = processCrisisModeInteraction({
    caregiver_id: caregiverId,
    raw_input: rawInput,
    events_created: recentEvents,
    all_events: context?.events ?? [],
    behavior,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: [],
  });

  return NextResponse.json({
    identity: CRISIS_MODE_IDENTITY,
    crisis_mode_interaction_layer: layer,
  });
}
