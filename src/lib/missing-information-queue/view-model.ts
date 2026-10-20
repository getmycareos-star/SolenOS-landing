import type {
  MissingInformationQueueLayerPayload,
  MissingInformationQueueLayerResult,
} from "./types";

export type MissingInformationViewItem = {
  id: string;
  question: string;
  importance: "LOW" | "MEDIUM" | "HIGH";
  status: "open" | "resolved" | "expired";
  source: string;
};

export type MissingInformationQueueView = {
  items: readonly MissingInformationViewItem[];
  health: MissingInformationQueueLayerPayload["health"];
  needsNext: readonly string[];
  criticalWarning?: string;
  source: "missing_information_queue_layer" | "stub";
};

export function toMissingInformationQueueView(
  layer?: MissingInformationQueueLayerPayload | MissingInformationQueueLayerResult | null,
): MissingInformationQueueView {
  if (!layer) {
    return {
      items: [],
      health: { openItems: 0, highPriorityItems: 0, resolvedItems: 0 },
      needsNext: [],
      source: "stub",
    };
  }

  const payload = "envelope" in layer ? toPayloadFromResult(layer) : layer;

  const items: MissingInformationViewItem[] =
    "state" in layer
      ? layer.state.items
          .filter((i) => i.status === "open")
          .slice(0, 8)
          .map((i) => ({
            id: i.id,
            question: i.question,
            importance: i.importance,
            status: i.status,
            source: i.source,
          }))
      : payload.needsNext.map((q, i) => ({
          id: `need-${i}`,
          question: q,
          importance: i === 0 && payload.highPriorityOpenCount > 0 ? "HIGH" : "MEDIUM",
          status: "open" as const,
          source: "queue",
        }));

  const criticalWarning =
    payload.health.highPriorityItems > 0
      ? "Critical information gaps are limiting recommendation quality."
      : undefined;

  return {
    items,
    health: payload.health,
    needsNext: payload.needsNext,
    criticalWarning,
    source: "missing_information_queue_layer",
  };
}

function toPayloadFromResult(
  layer: MissingInformationQueueLayerResult,
): MissingInformationQueueLayerPayload {
  return {
    openCount: layer.envelope.openCount,
    highPriorityOpenCount: layer.envelope.highPriorityOpenCount,
    confidencePenalty: layer.envelope.confidencePenalty,
    uncertaintyBoost: layer.envelope.uncertaintyBoost,
    needsNext: layer.envelope.needsNext,
    health: layer.envelope.health,
    recentResolutions: layer.resolutions.slice(-5),
  };
}
