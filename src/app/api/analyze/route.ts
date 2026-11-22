import { NextResponse } from "next/server";

export const runtime = "nodejs";
/**
 * Retired legacy analysis endpoint.
 *
 * Caregiver workflows use the authenticated Living Care Record APIs and the
 * backend-owned Qwen service. This prototype endpoint is closed in every
 * environment so its legacy hosted-provider pipeline cannot be reactivated.
 */
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error: "This older analysis route is no longer available.",
      caregiver_entry: "/workspace",
      code: "LEGACY_ANALYSIS_ENDPOINT_RETIRED",
    },
    { status: 410 },
  );
}
