import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCareContextRoot, processSituationRecompile } from "@/lib/situation-entry";
import {
  buildDegradedOutput,
  FINAL_OUTPUT_CONTRACT_IDENTITY,
  validateFinalOutput,
} from "@/lib/final-output-contract";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/output — canonical final output only */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: FINAL_OUTPUT_CONTRACT_IDENTITY,
      final_output: validateFinalOutput(
        buildDegradedOutput({
          reason: "No Care Context available yet.",
          questions: ["What is happening with care right now?"],
        }),
      ),
    });
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: caregiverId,
    trigger: "idle_refresh",
  });

  if (!recompiled) {
    return NextResponse.json({
      identity: FINAL_OUTPUT_CONTRACT_IDENTITY,
      final_output: validateFinalOutput(
        buildDegradedOutput({ reason: "Could not compile output from CareContext." }),
      ),
    });
  }

  validateFinalOutput(recompiled.final_output);

  return NextResponse.json({
    identity: FINAL_OUTPUT_CONTRACT_IDENTITY,
    final_output: recompiled.final_output,
    mvp_surface_area_layer: recompiled.mvp_surface_area_layer,
    continuous_execution_loop_layer: recompiled.continuous_execution_loop_layer,
  });
}
