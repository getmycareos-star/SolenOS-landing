import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CONTINUOUS_EXECUTION_IDENTITY,
  runIdleLoop,
} from "@/lib/continuous-execution-loop";
import { getCareContextRoot, processSituationRecompile } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/loop — idle loop refresh (recompute priorities + unresolved uncertainty) */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: CONTINUOUS_EXECUTION_IDENTITY,
      system_mode: "empty",
      loop_phase: "wait",
    });
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: caregiverId,
    trigger: "idle_refresh",
  });

  const idle = runIdleLoop({ caregiver_id: caregiverId, context });

  return NextResponse.json({
    identity: CONTINUOUS_EXECUTION_IDENTITY,
    continuous_execution_loop_layer: recompiled?.continuous_execution_loop_layer ?? null,
    idle_refresh: idle,
    final_output: recompiled?.final_output ?? null,
    mvp_surface_area_layer: recompiled?.mvp_surface_area_layer ?? null,
  });
}
