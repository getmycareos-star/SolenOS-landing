import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  MEMORY_STRATEGY_IDENTITY,
  processMemoryStrategy,
} from "@/lib/memory-strategy-engine";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/memory-strategy — memory tier classification and retrieval state */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);
  const recentEvents = context?.events.slice(-3) ?? [];

  const layer = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context?.events ?? [],
    as_of: new Date().toISOString(),
  });

  return NextResponse.json({
    identity: MEMORY_STRATEGY_IDENTITY,
    memory_strategy_layer: layer,
  });
}
