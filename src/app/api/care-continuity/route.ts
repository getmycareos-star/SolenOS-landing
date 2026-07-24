import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getCareContinuitySystemStatus,
  listCareContinuityEvents,
  CARE_CONTINUITY_ONE_LINE_TRUTH,
  CARE_CONTINUITY_PROHIBITED,
} from "@/lib/care-continuity-system";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/care-continuity — system status and event list */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const caseId = req.nextUrl.searchParams.get("case_id");

  const status = getCareContinuitySystemStatus(caregiverId, caseId);
  const events = listCareContinuityEvents(caregiverId, caseId);

  return NextResponse.json({
    identity: CARE_CONTINUITY_ONE_LINE_TRUTH,
    prohibited: CARE_CONTINUITY_PROHIBITED,
    status,
    events,
    total_events: events.length,
  });
}
