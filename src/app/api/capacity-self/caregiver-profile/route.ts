import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  getOrCreateCaregiverSelfProfile,
  tryLoadCaregiverSelfProfile,
  VALUES_CAPTURE_ROADMAP,
} from "@/lib/capacity-self";

/** GET /api/capacity-self/caregiver-profile */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const record =
    (await tryLoadCaregiverSelfProfile(caregiverId)) ??
    getOrCreateCaregiverSelfProfile(caregiverId);

  return NextResponse.json({
    profile: record,
    values_capture_roadmap: VALUES_CAPTURE_ROADMAP,
  });
}
