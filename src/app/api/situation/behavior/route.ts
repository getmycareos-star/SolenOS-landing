import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { BEHAVIOR_INTERPRETATION_IDENTITY, processBehaviorInterpretation } from "@/lib/behavior-interpretation-engine";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/behavior — behavior interpretation from CareEvents */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: BEHAVIOR_INTERPRETATION_IDENTITY,
      triggered: false,
    });
  }

  const recent = context.events.slice(-5);
  const prior = context.events.slice(0, -5);

  const layer = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created: recent,
    all_events: context.events,
    prior_events: prior,
    what_changed: [],
  });

  return NextResponse.json({
    identity: BEHAVIOR_INTERPRETATION_IDENTITY,
    behavior_interpretation_layer: layer,
  });
}
