import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCareContextRoot, processSituationRecompile } from "@/lib/situation-entry";
import {
  MVP_SURFACE_IDENTITY,
  resolveMvpSystemState,
} from "@/lib/mvp-surface-area";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/surface — MVP surface state and continuity home view */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);
  const eventCount = context?.events.length ?? 0;
  const systemState = resolveMvpSystemState(Boolean(context && eventCount > 0), eventCount);

  if (!context || eventCount === 0) {
    return NextResponse.json({
      identity: MVP_SURFACE_IDENTITY,
      system_state: "empty",
      first_screen_prompt: "What is happening right now?",
      continuity_home: null,
    });
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: caregiverId,
    trigger: "idle_refresh",
  });

  return NextResponse.json({
    identity: MVP_SURFACE_IDENTITY,
    system_state: systemState,
    mvp_surface_area_layer: recompiled?.mvp_surface_area_layer ?? null,
    continuous_execution_loop_layer: recompiled?.continuous_execution_loop_layer ?? null,
    behavior_interpretation_layer: recompiled?.behavior_interpretation_layer ?? null,
    continuity_decay_layer: recompiled?.continuity_decay_layer ?? null,
    north_star_experience_layer: recompiled?.north_star_experience_layer ?? null,
    clarification_engine_layer: recompiled?.clarification_engine_layer ?? null,
    memory_strategy_layer: recompiled?.memory_strategy_layer ?? null,
    trust_layer_engine_layer: recompiled?.trust_layer_engine_layer ?? null,
    crisis_mode_interaction_layer: recompiled?.crisis_mode_interaction_layer ?? null,
    multi_caregiver_context_layer: recompiled?.multi_caregiver_context_layer ?? null,
    audit_trail_layer: recompiled?.audit_trail_layer ?? null,
    state_of_care_summary_layer: recompiled?.state_of_care_summary_layer ?? null,
    care_context_diff_layer: recompiled?.care_context_diff_layer ?? null,
    care_timeline_engine_layer: recompiled?.care_timeline_engine_layer ?? null,
    task_extraction_layer: recompiled?.task_extraction_layer ?? null,
    current_state_view_layer: recompiled?.current_state_view_layer ?? null,
  });
}
