import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContinuityLink } from "../care-memory-layers/types";
import { buildContinuityLinks } from "../care-memory-layers/layer-continuity";
import { computeCompoundingMetrics } from "./compounding-metrics";
import { NETWORK_EFFECT_MOAT_IDENTITY } from "./contract-constants";
import {
  attemptUncertaintyResolution,
  buildEnrichmentActions,
  countNewRelationships,
} from "./enrichment";
import { matchEntities, matchEvents } from "./entity-matching";
import {
  assertContextGrew,
  countIsolatedRecords,
  deriveInteractionOutcomes,
} from "./interaction-outcomes";
import { computeMoatStrength, deriveMaturityStage, maturityMessage } from "./maturity";
import { getMoatStore, updateMoatStore } from "./store";
import type { NetworkEffectMoatResult } from "./types";

export { NETWORK_EFFECT_MOAT_IDENTITY };

export function processNetworkEffectMoat(input: {
  caregiver_id: string;
  new_events: CanonicalCareEvent[];
  prior_events: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  unresolved_questions: string[];
  what_changed: string[];
  dare: DareIngestResult | null;
  prior_link_count?: number;
}): NetworkEffectMoatResult {
  const store = getMoatStore(input.caregiver_id);

  const entity_matches = matchEntities(input.new_events, input.prior_events);
  const event_matches = matchEvents(input.new_events, input.prior_events);

  const resolved_uncertainties = attemptUncertaintyResolution({
    newEvents: input.new_events,
    priorUnresolvedQuestions: input.unresolved_questions.filter(
      (q) =>
        !store.resolved_uncertainties.some(
          (r) => r.question.toLowerCase() === q.toLowerCase(),
        ),
    ),
    priorEvents: input.prior_events,
    existingResolutions: store.resolved_uncertainties,
  });

  const continuityLinks = buildContinuityLinks(input.all_events);
  const new_relationships = countNewRelationships(
    continuityLinks,
    input.prior_link_count ?? 0,
  );

  const enrichment_actions = buildEnrichmentActions({
    newEvents: input.new_events,
    entityMatches: entity_matches,
    eventMatches: event_matches,
    resolvedUncertainties: resolved_uncertainties,
    continuityLinks,
    dare: input.dare,
  });

  const interaction_outcomes = deriveInteractionOutcomes({
    newEvents: input.new_events,
    eventMatches: event_matches,
    entityMatches: entity_matches,
    resolvedUncertainties: resolved_uncertainties,
    enrichmentActions: enrichment_actions,
    whatChanged: input.what_changed,
  });

  const firstEventAt =
    input.all_events.length > 0
      ? input.all_events.reduce((earliest, e) =>
          e.ingestion_time < earliest ? e.ingestion_time : earliest,
        input.all_events[0]!.ingestion_time)
      : null;

  updateMoatStore(input.caregiver_id, {
    resolved_uncertainties,
    enrichment_actions,
    ...(firstEventAt ? { first_event_at: firstEventAt } : {}),
    correction_increment: input.new_events.filter(
      (e) => e.integrity.sources.includes("user_correction"),
    ).length,
  });

  const updatedStore = getMoatStore(input.caregiver_id);

  const compounding_metrics = computeCompoundingMetrics({
    allEvents: input.all_events,
    continuityLinks,
    store: updatedStore,
    resolvedThisSession: resolved_uncertainties,
  });

  const moat_strength = computeMoatStrength(compounding_metrics);
  const maturity_stage = deriveMaturityStage(compounding_metrics);
  const isolated_records = countIsolatedRecords(
    input.new_events,
    event_matches,
    enrichment_actions,
  );

  return {
    interaction_outcomes,
    enrichment_actions,
    entity_matches,
    event_matches,
    resolved_uncertainties,
    new_relationships,
    compounding_metrics,
    moat_strength,
    maturity_stage,
    maturity_message: maturityMessage(maturity_stage),
    context_grew: assertContextGrew(interaction_outcomes),
    isolated_records,
  };
}
