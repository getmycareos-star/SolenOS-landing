import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  listCareEventsForCaregiver,
  tryLoadCareEventsForCaregiver,
} from "@/lib/care-events";
import { retrieveHistoricalContext } from "@/lib/care-record";
import { requireCareKeyFromRequest } from "@/lib/care-identity";

/** GET /api/care-record/context?q= — evidence-backed historical context for new input */
export async function GET(req: NextRequest) {
  const key = requireCareKeyFromRequest({
    caregiver_id: req.nextUrl.searchParams.get("caregiver_id"),
    care_session_id: req.nextUrl.searchParams.get("care_session_id"),
  });
  if (!key.ok) {
    return NextResponse.json({ error: key.error }, { status: 400 });
  }
  const query = req.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const events =
    (await tryLoadCareEventsForCaregiver(key.careKey)) ??
    listCareEventsForCaregiver(key.careKey);

  const context = retrieveHistoricalContext(events, query);
  return NextResponse.json({ context, care_key: key.careKey });
}

