import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getObservationWeeklySummary } from "@/lib/observation-intelligence";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/**
 * GET /api/observations/weekly-summary — weekly pattern aggregation.
 */
export async function GET(req: NextRequest) {
  const caregiverId =
    req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  const summary = getObservationWeeklySummary(caregiverId);
  return NextResponse.json(summary);
}
