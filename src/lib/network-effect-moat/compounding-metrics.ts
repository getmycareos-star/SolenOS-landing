import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContinuityLink } from "../care-memory-layers/types";
import { extractEntitiesFromEvents } from "./entity-matching";
import type { CompoundingMetrics, MoatStore, ResolvedUncertainty } from "./types";

export function computeCompoundingMetrics(input: {
  allEvents: CanonicalCareEvent[];
  continuityLinks: ContinuityLink[];
  store: MoatStore;
  resolvedThisSession: ResolvedUncertainty[];
}): CompoundingMetrics {
  const events = input.allEvents.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );

  const timestamps = events.map((e) => new Date(e.ingestion_time).getTime()).filter((t) => !isNaN(t));
  const firstTs = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const days_of_continuity = Math.max(
    0,
    Math.floor((Date.now() - firstTs) / 86400000),
  );

  const correction_count =
    input.store.cumulative_corrections +
    events.reduce((n, e) => n + e.integrity.correction_count, 0);

  const followUps = events.filter((e) => e.extracted_type === "follow_up");
  const closedFollowUps = input.continuityLinks.filter((l) => l.link_type === "follow_up").length;

  return {
    total_events: events.length,
    total_relationships: input.continuityLinks.length,
    total_entities: extractEntitiesFromEvents(events).length,
    correction_count,
    resolved_uncertainty_count:
      input.store.resolved_uncertainties.length + input.resolvedThisSession.length,
    days_of_continuity,
    linked_documents: new Set(events.map((e) => e.document_id).filter(Boolean)).size,
    open_follow_ups: Math.max(0, followUps.length - closedFollowUps),
    closed_follow_ups: closedFollowUps,
  };
}

export function describeCompoundingAssets(metrics: CompoundingMetrics): string[] {
  const assets: string[] = [];
  if (metrics.total_events > 0) assets.push(`${metrics.total_events} events in care history`);
  if (metrics.total_relationships > 0) assets.push(`${metrics.total_relationships} continuity relationships`);
  if (metrics.total_entities > 0) assets.push(`${metrics.total_entities} tracked entities`);
  if (metrics.correction_count > 0) assets.push(`${metrics.correction_count} caregiver corrections`);
  if (metrics.resolved_uncertainty_count > 0) {
    assets.push(`${metrics.resolved_uncertainty_count} resolved uncertainties`);
  }
  return assets;
}
