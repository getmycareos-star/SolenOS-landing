import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  listCareEventsForCaregiver,
  tryLoadCareEventsForCaregiver,
} from "@/lib/care-events";
import { searchCareRecord } from "@/lib/care-record";
import { requireCareKeyFromRequest } from "@/lib/care-identity";

/** GET /api/care-record/search?q= */
export async function GET(req: NextRequest) {
  const key = requireCareKeyFromRequest({
    caregiver_id: req.nextUrl.searchParams.get("caregiver_id"),
    care_session_id: req.nextUrl.searchParams.get("care_session_id"),
  });
  if (!key.ok) {
    return NextResponse.json({ error: key.error }, { status: 400 });
  }
  const query = req.nextUrl.searchParams.get("q") ?? "";

  const events =
    (await tryLoadCareEventsForCaregiver(key.careKey)) ??
    listCareEventsForCaregiver(key.careKey);

  const result = searchCareRecord(events, query);
  return NextResponse.json({ ...result, care_key: key.careKey });
}

