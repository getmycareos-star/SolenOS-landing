import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { CARE_CONTEXT_DIFF_IDENTITY } from "@/lib/care-context-diff-engine";
import { getCareContextRoot, processSituationRecompile } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/care-context-diff — human-understandable change translation */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: CARE_CONTEXT_DIFF_IDENTITY,
      care_context_diff_layer: null,
    });
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: caregiverId,
    trigger: "idle_refresh",
  });

  return NextResponse.json({
    identity: CARE_CONTEXT_DIFF_IDENTITY,
    care_context_diff_layer: recompiled?.care_context_diff_layer ?? null,
  });
}
