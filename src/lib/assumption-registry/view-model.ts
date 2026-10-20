import type { AssumptionRegistryLayerPayload, AssumptionRegistryLayerResult } from "./types";

export type AssumptionViewItem = {
  id: string;
  summary: string;
  status: "verified" | "active" | "stale";
  source: string;
};

export type AssumptionRegistryView = {
  items: readonly AssumptionViewItem[];
  health: AssumptionRegistryLayerPayload["health"];
  staleWarning?: string;
  source: "assumption_registry_layer" | "stub";
};

export function toAssumptionRegistryView(
  layer?: AssumptionRegistryLayerPayload | AssumptionRegistryLayerResult | null,
): AssumptionRegistryView {
  if (!layer) {
    return {
      items: [],
      health: {
        activeAssumptions: 0,
        expiredAssumptions: 0,
        invalidatedAssumptions: 0,
        staleAssumptions: 0,
      },
      source: "stub",
    };
  }

  const payload =
    "envelope" in layer ? toPayloadFromResult(layer) : layer;

  const items: AssumptionViewItem[] = payload.influenceHints.map((hint, i) => {
    const stale = hint.includes("stale");
    const verified = hint.startsWith("verified");
    return {
      id: `hint-${i}`,
      summary: hint.replace(/^(verified|active)(, stale)?: /, ""),
      status: stale ? "stale" : verified ? "verified" : "active",
      source: "registry",
    };
  });

  const staleWarning =
    payload.health.staleAssumptions > 0
      ? `${payload.health.staleAssumptions} active assumption${payload.health.staleAssumptions === 1 ? "" : "s"} have not been verified recently. Decision quality may be reduced.`
      : undefined;

  return {
    items,
    health: payload.health,
    staleWarning,
    source: "assumption_registry_layer",
  };
}

function toPayloadFromResult(
  layer: AssumptionRegistryLayerResult,
): AssumptionRegistryLayerPayload {
  return {
    influenceableCount: layer.envelope.influenceableCount,
    compositeBias: layer.envelope.compositeBias,
    staleInfluenceCount: layer.envelope.staleInfluenceCount,
    health: layer.envelope.health,
    influenceHints: layer.envelope.influenceHints,
    recentInvalidations: layer.invalidations.slice(-5),
  };
}
