import { NextResponse } from "next/server";

/**
 * Retired prototype endpoint.
 *
 * The former pipeline wrote to legacy filesystem-backed stores and did not
 * establish authenticated PostgreSQL persistence. The caregiver workspace
 * uses the authenticated FastAPI care workflows instead. Keep this route
 * closed rather than returning a successful-looking non-authoritative result.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This legacy analysis endpoint is no longer available. Use the authenticated SolenOS care workflow.",
      code: "LEGACY_ANALYSIS_ENDPOINT_RETIRED",
    },
    { status: 410 },
  );
}
