import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ARCHITECTURAL_RULES,
  BOUNDARIES_IDENTITY,
  enforceArchitecturalBoundaries,
} from "@/lib/architectural-boundaries";

/** GET /api/situation/boundaries — architectural boundary contract */
export async function GET(_req: NextRequest) {
  const layer = enforceArchitecturalBoundaries({
    text_surfaces: {},
    has_decision_trace: true,
    has_evidence_links: true,
    has_explicit_uncertainty: true,
    preserves_history: true,
    confidence_proportional: true,
  });

  return NextResponse.json({
    identity: BOUNDARIES_IDENTITY,
    rules: ARCHITECTURAL_RULES,
    architectural_boundaries_layer: layer,
  });
}
