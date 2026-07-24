import type {
  ContextWeight,
  ContextWeightSource,
  ContextWeightingResult,
  WeightedContextItem,
} from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function compositeContextWeight(w: ContextWeight): number {
  // Balanced blend — additive soft influence, not action selection.
  return clamp01(w.recency * 0.35 + w.relevance * 0.4 + w.reliability * 0.25);
}

export function weightContextItem(params: {
  id: string;
  source: ContextWeightSource;
  label: string;
  recency?: number;
  relevance?: number;
  reliability?: number;
}): WeightedContextItem {
  const weights: ContextWeight = {
    recency: clamp01(params.recency ?? 0.5),
    relevance: clamp01(params.relevance ?? 0.5),
    reliability: clamp01(params.reliability ?? 0.5),
  };
  return {
    id: params.id,
    source: params.source,
    label: params.label,
    weights,
    composite: compositeContextWeight(weights),
  };
}

/**
 * Derive context weights from available runtime signals.
 * Prefer additive inputs — never invents content.
 */
export function processContextWeighting(params: {
  userInput?: string;
  memoryLabels?: readonly { id: string; label: string; confidence?: number; recency?: number }[];
  documentLabels?: readonly { id: string; label: string; confidence?: number }[];
  assumptionHints?: readonly string[];
  careContextHints?: readonly string[];
  inputAgeHours?: number;
}): ContextWeightingResult {
  const items: WeightedContextItem[] = [];

  if (params.userInput?.trim()) {
    const age = params.inputAgeHours ?? 0;
    const recency = clamp01(Math.exp(-age / 24));
    items.push(
      weightContextItem({
        id: "user_input",
        source: "user_input",
        label: params.userInput.trim().slice(0, 120),
        recency,
        relevance: 0.85,
        reliability: 0.7,
      }),
    );
  }

  for (const m of params.memoryLabels ?? []) {
    items.push(
      weightContextItem({
        id: m.id,
        source: "memory",
        label: m.label,
        recency: m.recency ?? 0.5,
        relevance: 0.65,
        reliability: m.confidence ?? 0.5,
      }),
    );
  }

  for (const d of params.documentLabels ?? []) {
    items.push(
      weightContextItem({
        id: d.id,
        source: "document",
        label: d.label,
        recency: 0.7,
        relevance: 0.75,
        reliability: d.confidence ?? 0.6,
      }),
    );
  }

  (params.assumptionHints ?? []).slice(0, 5).forEach((hint, i) => {
    items.push(
      weightContextItem({
        id: `assumption_${i}`,
        source: "assumption",
        label: hint,
        recency: 0.55,
        relevance: 0.5,
        reliability: 0.4,
      }),
    );
  });

  (params.careContextHints ?? []).slice(0, 5).forEach((hint, i) => {
    items.push(
      weightContextItem({
        id: `care_context_${i}`,
        source: "care_context",
        label: hint,
        recency: 0.6,
        relevance: 0.7,
        reliability: 0.55,
      }),
    );
  });

  items.sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id));

  const meanComposite =
    items.length === 0
      ? 0
      : items.reduce((sum, i) => sum + i.composite, 0) / items.length;

  return { items, meanComposite: clamp01(meanComposite) };
}
