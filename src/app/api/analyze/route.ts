import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired legacy analysis endpoint.
 *
 * Caregiver workflows use the authenticated Living Care Record APIs and the
 * backend-owned Qwen service. This prototype endpoint is intentionally closed
 * in every environment so its legacy hosted-provider pipeline cannot be
 * reactivated accidentally.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This older analysis route is no longer available.",
      caregiver_entry: "/workspace",
    },
    { status: 404 },
  );
}
