import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  runPatternIntelligence,
  toPatternIntelligenceLayerPayload,
  getPatternExplanation,
} from "@/lib/pattern-intelligence";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/pattern-intelligence — run proactive + pattern detection */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const caseId = req.nextUrl.searchParams.get("case_id");

  const result = runPatternIntelligence(caregiverId, caseId);

  return NextResponse.json({
    result,
    layer: toPatternIntelligenceLayerPayload(result),
    explanation: getPatternExplanation(caregiverId, caseId),
  });
}

/** POST /api/pattern-intelligence — explicit run after journey update */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;
  const caseId = typeof input.case_id === "string" ? input.case_id : null;

  const result = runPatternIntelligence(caregiverId, caseId);

  return NextResponse.json({
    result,
    layer: toPatternIntelligenceLayerPayload(result),
  });
}
