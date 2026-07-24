import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFINING_PRINCIPLE,
  EXPERIENCE_TEST_QUESTION,
  NORTH_STAR_EXPERIENCE_IDENTITY,
  NORTH_STAR_FEELING,
  processNorthStarExperience,
} from "@/lib/north-star-experience";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/experience — north star experience evaluation */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);

  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: NORTH_STAR_EXPERIENCE_IDENTITY,
      north_star_feeling: NORTH_STAR_FEELING,
      defining_principle: DEFINING_PRINCIPLE,
      experience_test_question: EXPERIENCE_TEST_QUESTION,
      active: false,
    });
  }

  const layer = processNorthStarExperience({
    caregiver_id: caregiverId,
    raw_input: "",
    is_first_situation: false,
    events_created: [],
    all_events: context.events,
    prior_event_count: Math.max(0, context.events.length - 1),
    what_changed: [],
    what_i_understood: [],
    what_is_uncertain: [],
    what_needs_clarification: [],
    has_decision_trace: true,
    has_confidence_surface: true,
  });

  return NextResponse.json({
    identity: NORTH_STAR_EXPERIENCE_IDENTITY,
    north_star_experience_layer: layer,
  });
}
