import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCareContextRoot } from "@/lib/situation-entry";
import { buildContinuityLinks } from "@/lib/care-memory-layers/layer-continuity";
import {
  computeCompoundingMetrics,
  computeMoatStrength,
  deriveMaturityStage,
  describeCompoundingAssets,
  getMoatStore,
  maturityMessage,
  NETWORK_EFFECT_MOAT_IDENTITY,
} from "@/lib/network-effect-moat";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/moat — compounding metrics and moat strength */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  const context = getCareContextRoot(caregiverId);
  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: NETWORK_EFFECT_MOAT_IDENTITY,
      maturity_stage: "early",
      maturity_message: maturityMessage("early"),
      compounding_metrics: {
        total_events: 0,
        total_relationships: 0,
        total_entities: 0,
        correction_count: 0,
        resolved_uncertainty_count: 0,
        days_of_continuity: 0,
        linked_documents: 0,
        open_follow_ups: 0,
        closed_follow_ups: 0,
      },
      moat_strength: {
        score: 0,
        level: "emerging",
        reason: "Early continuity — value grows with every structured interaction.",
        irreversibility_factors: ["First interactions will begin compounding continuity"],
      },
      compounding_assets: [],
    });
  }

  const store = getMoatStore(caregiverId);
  const links = buildContinuityLinks(context.events);
  const metrics = computeCompoundingMetrics({
    allEvents: context.events,
    continuityLinks: links,
    store,
    resolvedThisSession: [],
  });

  const moat_strength = computeMoatStrength(metrics);
  const maturity_stage = deriveMaturityStage(metrics);

  return NextResponse.json({
    identity: NETWORK_EFFECT_MOAT_IDENTITY,
    maturity_stage,
    maturity_message: maturityMessage(maturity_stage),
    compounding_metrics: metrics,
    moat_strength,
    compounding_assets: describeCompoundingAssets(metrics),
    resolved_uncertainties: store.resolved_uncertainties,
    enrichment_history: store.enrichment_history.slice(-20),
  });
}
