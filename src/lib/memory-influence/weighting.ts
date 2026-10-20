import type { BehaviorProfile } from "../input-classification";
import type { ModuleWeights } from "../settings-governance/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type {
  MemoryInfluenceEnvelope,
  MemoryInfluenceEntry,
  MemoryTaggingSystem,
  SolenOSMemory,
} from "./types";

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampWeight(value: number): number {
  return Math.max(0, Math.min(2, value));
}

function clampVerbosity(value: number): number {
  return Math.max(0.55, Math.min(1.15, value));
}

function applyTagDeprioritization(
  weight: number,
  entry: MemoryInfluenceEntry,
  tagging: MemoryTaggingSystem,
): number {
  let adjusted = weight;
  if (entry.tags.incorrect && tagging.incorrect) return 0;
  if (entry.tags.outdated && tagging.outdated) adjusted *= 0.25;
  if (entry.tags.sensitive && tagging.sensitive) adjusted *= 0.5;
  return adjusted;
}

function aggregateCategoryBias(
  entries: readonly MemoryInfluenceEntry[],
  categoryWeight: number,
  tagging: MemoryTaggingSystem,
): number {
  if (entries.length === 0 || categoryWeight <= 0) return 0;

  let sum = 0;
  for (const entry of entries) {
    const effective = applyTagDeprioritization(
      entry.influenceWeight * entry.confidence,
      entry,
      tagging,
    );
    sum += effective;
  }

  return clampUnit((sum / entries.length) * categoryWeight);
}

/**
 * Compute memory influence envelope — probability bias, not output modification.
 * Care Context ALWAYS overrides emotional memory dominance.
 */
export function computeMemoryInfluenceEnvelope(
  memory: SolenOSMemory,
  careContext?: SituationalCareContext,
): MemoryInfluenceEnvelope {
  const { memoryWeights, taggingSystem } = memory;

  let identityBias = aggregateCategoryBias(
    memory.identityMemory.entries,
    memoryWeights.identity,
    taggingSystem,
  );
  let patternBias = aggregateCategoryBias(
    memory.longTermPatternMemory.entries,
    memoryWeights.patterns,
    taggingSystem,
  );
  let operationalBias = aggregateCategoryBias(
    memory.operationalMemory.entries,
    memoryWeights.operational,
    taggingSystem,
  );
  let emotionalBias = aggregateCategoryBias(
    memory.emotionalMemory.entries,
    memoryWeights.emotional,
    taggingSystem,
  );

  if (careContext) {
    if (careContext.urgencyLevel === "CRITICAL" || careContext.situationType === "emergency") {
      emotionalBias *= 0.3;
      operationalBias = Math.max(operationalBias, operationalBias * 1.1);
    }
    if (careContext.userIntentSignal.confidence >= 0.6 && careContext.userIntentSignal.explicitIntent) {
      identityBias *= 0.85;
      patternBias *= 0.9;
    }
  }

  const compositeInfluence = clampUnit(
    identityBias + patternBias + operationalBias + emotionalBias,
  );

  const interpretationHints = buildInterpretationHints(memory);

  return {
    identityBias,
    patternBias,
    operationalBias,
    emotionalBias,
    compositeInfluence,
    interpretationHints,
  };
}

function buildInterpretationHints(memory: SolenOSMemory): readonly string[] {
  if (memory.visibility === "hidden") return [];

  const hints: string[] = [];
  const allEntries = [
    ...memory.identityMemory.entries,
    ...memory.longTermPatternMemory.entries,
    ...memory.operationalMemory.entries,
    ...memory.emotionalMemory.entries,
  ].filter((e) => !e.tags.incorrect);

  for (const entry of allEntries.slice(0, memory.visibility === "summary" ? 3 : 8)) {
    if (entry.tags.outdated && memory.taggingSystem.outdated) continue;
    hints.push(`influence:${entry.influenceLabel}`);
  }

  return hints;
}

export function applyMemoryBehaviorWeighting(
  profile: BehaviorProfile,
  envelope: MemoryInfluenceEnvelope,
): BehaviorProfile {
  let emotional = profile.emotional_acknowledgment;
  if (envelope.emotionalBias >= 0.15 && emotional === "minimal") {
    emotional = "standard";
  } else if (envelope.emotionalBias < 0.05 && emotional === "standard") {
    emotional = "minimal";
  }

  let prioritization = profile.prioritization_aggressiveness;
  if (envelope.operationalBias >= 0.2 || envelope.patternBias >= 0.2) {
    prioritization = "elevated";
  }

  let verbosity = profile.verbosity_factor;
  if (envelope.identityBias >= 0.15) {
    verbosity = clampVerbosity(verbosity * 0.92);
  }
  if (envelope.operationalBias >= 0.25) {
    verbosity = clampVerbosity(verbosity * 0.88);
  }

  return {
    ...profile,
    emotional_acknowledgment: emotional,
    prioritization_aggressiveness: prioritization,
    verbosity_factor: verbosity,
  };
}

export function mergeMemoryWithModuleWeights(
  weights: ModuleWeights,
  envelope: MemoryInfluenceEnvelope,
): ModuleWeights {
  const influenceFactor = 1 + envelope.compositeInfluence * 0.15;
  return {
    memory: clampWeight(weights.memory * influenceFactor),
    emotional: clampWeight(weights.emotional * (1 + envelope.emotionalBias * 0.2)),
    time: clampWeight(weights.time * (1 + envelope.operationalBias * 0.1)),
    priority: clampWeight(weights.priority * (1 + envelope.patternBias * 0.15)),
    safety: weights.safety,
    notification: weights.notification,
  };
}
