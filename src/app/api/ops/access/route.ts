import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertOpsAccess } from "@/lib/ops-console/access";
import { ANALYZE_OPS_KEY_HEADER } from "@/lib/analyze-pipeline/caregiver-entry-gate";

/**
 * GET /api/ops/access — validate ops key for caregiver chrome ops sections.
 * Invalid / missing → 404 (same posture as /ops).
 */
export async function GET(req: NextRequest) {
  const key =
    req.nextUrl.searchParams.get("key") ??
    req.nextUrl.searchParams.get("ops_key") ??
    req.headers.get(ANALYZE_OPS_KEY_HEADER);

  if (!assertOpsAccess(key)) {
    return NextResponse.json({ ops: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ops: true });
}
