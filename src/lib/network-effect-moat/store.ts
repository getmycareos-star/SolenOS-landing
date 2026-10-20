import type { MoatStore, ResolvedUncertainty, EnrichmentAction } from "./types";

const stores = new Map<string, MoatStore>();

function createEmptyStore(caregiverId: string): MoatStore {
  return {
    caregiver_id: caregiverId,
    resolved_uncertainties: [],
    enrichment_history: [],
    cumulative_corrections: 0,
    first_event_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function getMoatStore(caregiverId: string): MoatStore {
  return stores.get(caregiverId) ?? createEmptyStore(caregiverId);
}

export function updateMoatStore(
  caregiverId: string,
  update: {
    resolved_uncertainties?: ResolvedUncertainty[];
    enrichment_actions?: EnrichmentAction[];
    correction_increment?: number;
    first_event_at?: string;
  },
): MoatStore {
  const current = getMoatStore(caregiverId);
  const store: MoatStore = {
    ...current,
    resolved_uncertainties: update.resolved_uncertainties
      ? [...current.resolved_uncertainties, ...update.resolved_uncertainties]
      : current.resolved_uncertainties,
    enrichment_history: update.enrichment_actions
      ? [...current.enrichment_history, ...update.enrichment_actions]
      : current.enrichment_history,
    cumulative_corrections:
      current.cumulative_corrections + (update.correction_increment ?? 0),
    first_event_at: current.first_event_at ?? update.first_event_at ?? null,
    updated_at: new Date().toISOString(),
  };
  stores.set(caregiverId, store);
  return store;
}

export function resetMoatStore(): void {
  stores.clear();
}

export function listResolvedUncertainties(caregiverId: string): ResolvedUncertainty[] {
  return getMoatStore(caregiverId).resolved_uncertainties;
}
