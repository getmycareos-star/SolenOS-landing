import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getContinuityGraphForCaregiver,
  getContinuityGraphSnapshot,
  runContinuityIntelligence,
  CONTINUITY_GRAPH_IDENTITY,
} from "@/lib/continuity-graph";
import { tryLoadContinuityGraphForCaregiver } from "@/lib/continuity-graph/server";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/continuity-graph — universal continuity graph with intelligence */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const caseId = req.nextUrl.searchParams.get("case_id");

  const fromPostgres = await tryLoadContinuityGraphForCaregiver(caregiverId);
  const snapshot =
    fromPostgres != null
      ? {
          graph: fromPostgres,
          new_nodes: [],
          new_edges: [],
          cascade_chains: [],
          context_reasoning: {
            known: [],
            unknown: [],
            confidence: "insufficient" as const,
            questions: [],
            completeness_score: 0,
          },
        }
      : getContinuityGraphSnapshot(caregiverId, caseId ?? null);

  const graph =
    snapshot?.graph ?? getContinuityGraphForCaregiver(caregiverId, caseId ?? null);

  const insights = runContinuityIntelligence(graph);

  return NextResponse.json({
    identity: CONTINUITY_GRAPH_IDENTITY,
    graph,
    total_nodes: graph.nodes.length,
    total_edges: graph.edges.length,
    cascade_chains: snapshot?.cascade_chains ?? [],
    context_reasoning: snapshot?.context_reasoning ?? null,
    continuity_insights: insights,
  });
}
