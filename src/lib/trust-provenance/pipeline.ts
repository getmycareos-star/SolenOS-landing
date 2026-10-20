import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { InputProvenance } from "../care-events/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { buildAuditTrailSummary } from "./audit-query";
import { assessResponseConfidence } from "./confidence-assessment";
import { INSUFFICIENT_EVIDENCE_MESSAGE, TRUST_PROVENANCE_IDENTITY } from "./contract-constants";
import { buildEvidenceBundles } from "./evidence-inspection";
import {
  buildDareCandidateProvenance,
  buildProvenanceRecords,
} from "./provenance-model";
import { buildReasoningChains } from "./reasoning-transparency";
import {
  buildGenerationBoundaries,
  buildRetrievalContext,
} from "./retrieval-only";
import { buildTrustIndicators } from "./trust-indicators";
import type { TrustProvenanceResult } from "./types";

export { TRUST_PROVENANCE_IDENTITY };

export function processTrustProvenance(input: {
  caregiver_id: string;
  events_created: CanonicalCareEvent[];
  context_events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  unresolved_questions: string[];
  what_changed: string[];
  capture_provenance?: InputProvenance | null;
}): TrustProvenanceResult {
  const eventProvenance = buildProvenanceRecords(
    input.events_created,
    input.dare,
    input.capture_provenance,
  );

  const candidateProvenance = input.dare ? buildDareCandidateProvenance(input.dare) : [];
  const provenance_records = [...eventProvenance, ...candidateProvenance].filter(
    (p, i, arr) => arr.findIndex((x) => x.fact_id === p.fact_id) === i,
  );

  const eventIds = [
    ...input.events_created.map((e) => e.id),
    ...input.context_events.slice(-10).map((e) => e.id),
  ];
  const audit_trail_summary = buildAuditTrailSummary([...new Set(eventIds)]);

  const trust_indicators = buildTrustIndicators(
    input.events_created,
    provenance_records,
    input.dare,
  );

  const retrieval_context = buildRetrievalContext({
    events: [...input.context_events, ...input.events_created],
    dare: input.dare,
    unresolved_questions: input.unresolved_questions,
  });

  const confidence_assessment = assessResponseConfidence({
    events: input.events_created,
    provenance_records,
    unresolved_questions: input.unresolved_questions,
    dare: input.dare,
  });

  const evidence_bundles = buildEvidenceBundles({
    events_created: input.events_created,
    context_events: input.context_events,
    dare: input.dare,
    audit_summaries: audit_trail_summary,
    what_changed: input.what_changed,
    unresolved_questions: input.unresolved_questions,
  });

  const reasoning_chains = buildReasoningChains({
    events_created: input.events_created,
    what_changed: input.what_changed,
    clarification_questions: input.unresolved_questions,
  });

  return {
    provenance_records,
    trust_indicators,
    audit_trail_summary,
    evidence_bundles,
    reasoning_chains,
    confidence_assessment,
    retrieval_context,
    generation_boundaries: buildGenerationBoundaries(),
    insufficient_evidence_message: INSUFFICIENT_EVIDENCE_MESSAGE,
  };
}
