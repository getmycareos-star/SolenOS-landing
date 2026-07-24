import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  generateFactualReflection,
  getOrCreateCaregiverSelfProfile,
} from "@/lib/capacity-self";

/** GET /api/capacity-self/reflection — plain factual weekly record */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const record = getOrCreateCaregiverSelfProfile(caregiverId);
  const reflection = generateFactualReflection(record.resolved_items);
  return NextResponse.json(reflection);
}
