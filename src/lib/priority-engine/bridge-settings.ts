import type { SolenOSSettings } from "../settings-governance/types";
import { DEFAULT_PRIORITY_ENGINE_WEIGHTS } from "./defaults";
import type { PriorityWeights } from "./types";

function clampWeightSlot(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("priority weight override must be a finite number — refusing to guess");
  }
  return Math.max(0, Math.min(2, value));
}

/**
 * Read PriorityWeights from settings governance / explicit overrides.
 * Defaults: Wt=0.35, We=0.20, Wm=0.20, Wd=0.20, Wr=0.25
 *
 * Settings may tune via systemMode (soft) or explicit priorityWeights override
 * on ProcessPriorityEngineLayerParams — never invents missing slots.
 */
export function readPriorityWeightsFromSettings(
  settings?: SolenOSSettings,
  override?: Partial<PriorityWeights>,
): PriorityWeights {
  let weights: PriorityWeights = { ...DEFAULT_PRIORITY_ENGINE_WEIGHTS };

  if (settings) {
    switch (settings.systemMode) {
      case "CONSERVATIVE":
        weights = {
          ...weights,
          Wt: weights.Wt * 0.9,
          Wr: weights.Wr * 1.15,
        };
        break;
      case "AUTONOMOUS":
        weights = {
          ...weights,
          Wt: weights.Wt * 1.1,
          Wr: weights.Wr * 0.95,
        };
        break;
      case "CRISIS":
        weights = {
          ...weights,
          Wt: weights.Wt * 1.2,
          We: weights.We * 1.1,
          Wr: weights.Wr * 1.1,
        };
        break;
      default:
        break;
    }
  }

  if (override) {
    const next = { ...weights };
    if (override.Wt !== undefined) next.Wt = clampWeightSlot(override.Wt);
    if (override.We !== undefined) next.We = clampWeightSlot(override.We);
    if (override.Wm !== undefined) next.Wm = clampWeightSlot(override.Wm);
    if (override.Wd !== undefined) next.Wd = clampWeightSlot(override.Wd);
    if (override.Wr !== undefined) next.Wr = clampWeightSlot(override.Wr);
    weights = next;
  }

  return weights;
}

export function mergePriorityWeightsWithDefaults(
  partial?: Partial<PriorityWeights>,
): PriorityWeights {
  return readPriorityWeightsFromSettings(undefined, partial);
}
