import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getCareJourneyGraphForCaregiver,
  tryLoadGraphForCaregiver,
} from "@/lib/care-journey-graph/server";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/care-journey/graph — structured care journey with relationships */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const caseId = req.nextUrl.searchParams.get("case_id");

  const fromPostgres = await tryLoadGraphForCaregiver(caregiverId);
  const graph =
    fromPostgres ??
    getCareJourneyGraphForCaregiver(caregiverId, caseId ?? null);

  return NextResponse.json({
    graph,
    total_events: graph.events.length,
    total_relationships: graph.relationships.length,
  });
}
