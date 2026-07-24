import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { CLARIFICATION_ENGINE_IDENTITY, processClarificationEngine } from "@/lib/clarification-engine";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/clarification — clarification engine state */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const rawInput = req.nextUrl.searchParams.get("raw_input") ?? "";
  const context = getCareContextRoot(caregiverId);

  const layer = processClarificationEngine({
    caregiver_id: caregiverId,
    raw_input: rawInput,
    events_created: context?.events.slice(-3) ?? [],
    what_is_uncertain: [],
  });

  return NextResponse.json({
    identity: CLARIFICATION_ENGINE_IDENTITY,
    clarification_engine_layer: layer,
  });
}
