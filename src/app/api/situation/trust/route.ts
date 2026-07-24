import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCareContextRoot } from "@/lib/situation-entry";
import {
  buildCaregiverAuditSummary,
  buildEvidenceBundles,
  buildProvenanceRecords,
  buildReasoningChains,
  buildRetrievalContext,
  buildTrustIndicators,
  assessResponseConfidence,
  runRetrievalOnlyGeneration,
  TRUST_PROVENANCE_IDENTITY,
} from "@/lib/trust-provenance";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/trust — trust, provenance, and evidence inspection */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const question = req.nextUrl.searchParams.get("question");
  const eventId = req.nextUrl.searchParams.get("event_id");

  const context = getCareContextRoot(caregiverId);
  if (!context || context.events.length === 0) {
    return NextResponse.json({
      identity: TRUST_PROVENANCE_IDENTITY,
      sufficient_for_answer: false,
      message: "I don't have enough information to answer this confidently.",
      provenance_records: [],
      trust_indicators: [],
      audit_trail_summary: [],
      evidence_bundles: [],
    });
  }

  const events = eventId
    ? context.events.filter((e) => e.id === eventId)
    : context.events;

  const provenance_records = buildProvenanceRecords(events, null);
  const audit_trail_summary = buildCaregiverAuditSummary(caregiverId);
  const trust_indicators = buildTrustIndicators(events, provenance_records, null);

  const retrieval_context = buildRetrievalContext({
    events: context.events,
    dare: null,
    unresolved_questions: [],
  });

  const confidence_assessment = assessResponseConfidence({
    events,
    provenance_records,
    unresolved_questions: [],
    dare: null,
  });

  const evidence_bundles = buildEvidenceBundles({
    events_created: events.slice(-3),
    context_events: context.events,
    dare: null,
    audit_summaries: audit_trail_summary,
    what_changed: [],
    unresolved_questions: [],
  });

  const reasoning_chains = buildReasoningChains({
    events_created: events.slice(-3),
    what_changed: [],
    clarification_questions: [],
  });

  const generation = question
    ? runRetrievalOnlyGeneration({
        events: context.events,
        dare: null,
        unresolved_questions: [],
        question,
      })
    : null;

  return NextResponse.json({
    identity: TRUST_PROVENANCE_IDENTITY,
    provenance_records,
    trust_indicators,
    audit_trail_summary,
    evidence_bundles,
    reasoning_chains,
    confidence_assessment,
    retrieval_context,
    generation,
  });
}
