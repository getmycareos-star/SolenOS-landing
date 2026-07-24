import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  listCareEventsForCaregiver,
  tryLoadCareEventsForCaregiver,
} from "@/lib/care-events";
import { buildTimeline, searchCareRecord, retrieveHistoricalContext } from "@/lib/care-record";
import { requireCareKeyFromRequest } from "@/lib/care-identity";

async function loadEvents(caregiverId: string) {
  const fromPostgres = await tryLoadCareEventsForCaregiver(caregiverId);
  return fromPostgres ?? listCareEventsForCaregiver(caregiverId);
}

function careKeyOr400(req: NextRequest) {
  return requireCareKeyFromRequest({
    caregiver_id: req.nextUrl.searchParams.get("caregiver_id"),
    care_session_id: req.nextUrl.searchParams.get("care_session_id"),
  });
}

/** GET /api/care-record/timeline */
export async function GET(req: NextRequest) {
  const key = careKeyOr400(req);
  if (!key.ok) {
    return NextResponse.json({ error: key.error }, { status: 400 });
  }
  const events = await loadEvents(key.careKey);
  const timeline = buildTimeline(events);
  return NextResponse.json({ timeline, total: timeline.length, care_key: key.careKey });
}

