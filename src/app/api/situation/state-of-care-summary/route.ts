import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { STATE_OF_CARE_SUMMARY_IDENTITY } from "@/lib/state-of-care-summary-engine";
import { getCareContextRoot, processSituationRecompile } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/state-of-care-summary — decision-ready CareContext compression */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: STATE_OF_CARE_SUMMARY_IDENTITY,
      state_of_care_summary_layer: null,
    });
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: caregiverId,
    trigger: "idle_refresh",
  });

  return NextResponse.json({
    identity: STATE_OF_CARE_SUMMARY_IDENTITY,
    state_of_care_summary_layer: recompiled?.state_of_care_summary_layer ?? null,
  });
}
