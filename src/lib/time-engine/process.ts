import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { BehaviorProfile } from "../input-classification";
import type {
  GovernanceApplicationResult,
  SolenOSSettings,
} from "../settings-governance/types";
import type {
  MemoryInfluenceEnvelope,
  MemoryInfluenceState,
} from "../memory-influence/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import { readTimeEngineFromSettings } from "./bridge-settings";
import { buildHorizonBlend, classifyTemporalInput } from "./classify";
import { extractTimeInputSignals } from "./extract-signals";
import { runTimeEngineGuarantee } from "./guarantee";
import {
  computeDependencyBoost,
  resolveMemoryTimeOverride,
  resolveTimeConflict,
} from "./memory-override";
import {
  applyTimeEngineBehaviorWeighting as applyBehaviorWeighting,
  computeTimeEngineWeightEnvelope,
  mergeTimeEngineWithModuleWeights,
} from "./weighting";
import type {
  TemporalPrioritySignal,
  TimeEngineLayerPayload,
  TimeEngineLayerResult,
} from "./types";

export type ProcessTimeEngineLayerParams = {
  input: string;
  governanceSettings?: SolenOSSettings;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  memoryState?: MemoryInfluenceState;
  memoryEnvelope?: MemoryInfluenceEnvelope;
  /** Medical urgency — consumed for reinforcement context only; never replaced. */
  urgencyDetection?: UrgencyDetectionResult;
  relevanceDeltaHours?: number;
};

/**
 * TIME ENGINE LAYER — after Memory Influence + Care Profile emotional weighting;
 * before Priority Engine / conflict resolution.
 * Emits TemporalPrioritySignal weight structures only — never schedules or reminds.
 */
export function processTimeEngineLayer(
  params: ProcessTimeEngineLayerParams,
): TimeEngineLayerResult {
  const engine = readTimeEngineFromSettings(params.governanceSettings);
  const signals = extractTimeInputSignals(params.input);

  // Coordinate with care-context timePressure — do not merge into urgency score.
  // Soft classification shift only when pressure is high and timezone detection is on.
  let timezoneShiftHours = 0;
  if (engine.timezoneDetection && params.careContext?.environmentSignals.timePressure === "high") {
    timezoneShiftHours = -0.5;
  } else if (
    engine.coarseLocationEnabled &&
    params.careContext?.environmentSignals.locationContext === "hospital"
  ) {
    timezoneShiftHours = -0.25;
  }

  const emotionalBias = params.memoryEnvelope?.emotionalBias ?? 0;
  const medicalReinforce =
    params.urgencyDetection?.risk_level === "critical"
      ? 1.15
      : params.urgencyDetection?.risk_level === "high"
        ? 1.08
        : 1;

  const reinforcementFactor = Math.min(1.35, medicalReinforce + emotionalBias * 0.25);

  const temporal = classifyTemporalInput({
    signals,
    engine,
    relevanceDeltaHours: params.relevanceDeltaHours ?? 0,
    timezoneShiftHours,
    reinforcementFactor: signals.missingTime ? 1 : reinforcementFactor,
  });

  const memoryOverride = resolveMemoryTimeOverride({
    temporal,
    memoryState: params.memoryState,
    memoryEnvelope: params.memoryEnvelope,
  });

  const conflict = resolveTimeConflict({ signals, memoryOverride });

  let confidence =
    temporal.kind === "classified" ? temporal.classification.confidence : temporal.state.confidence;
  if (conflict?.uncertaintyFlagged) {
    confidence = Math.max(0.2, confidence - (memoryOverride?.confidenceReduction ?? 0.15));
  }

  const dependencyBoost = computeDependencyBoost({
    careProfile: params.careProfile,
    memoryEnvelope: params.memoryEnvelope,
    emotionalBias,
  });

  let urgencyScore = 0;
  let decayAdjustedUrgency = 0;
  let activeHorizon: TemporalPrioritySignal["activeHorizon"] = "UNSCHEDULED";

  if (temporal.kind === "classified") {
    activeHorizon = temporal.classification.horizon;
    // Memory may suggest alternate horizon but primary classification stays visible.
    // Apply slight decay reinforcement only — do not replace visible classification.
    urgencyScore = temporal.classification.urgencyScore;
    decayAdjustedUrgency = temporal.classification.decayAdjustedUrgency;

    if (
      memoryOverride?.suggestedHorizon &&
      memoryOverride.suggestedHorizon !== temporal.classification.horizon &&
      !conflict?.explicitPreferred
    ) {
      // Soft pull toward memory suggestion without overriding visible horizon.
      decayAdjustedUrgency = Math.min(
        1,
        decayAdjustedUrgency + dependencyBoost * 0.15,
      );
    }

    // Attach reduced confidence onto classification object for downstream visibility.
    temporal.classification = {
      ...temporal.classification,
      confidence,
    };
  }

  const prioritySignal: TemporalPrioritySignal = {
    horizon: engine.timeHorizonModel,
    activeHorizon,
    urgencyScore,
    decayAdjustedUrgency,
    dependencyBoost,
    strictMode: engine.strictTimeHorizonMode,
    blendedHorizons:
      temporal.kind === "classified"
        ? buildHorizonBlend(
            temporal.classification.horizon,
            decayAdjustedUrgency,
            engine.strictTimeHorizonMode,
          )
        : undefined,
  };

  const envelope = computeTimeEngineWeightEnvelope({
    decayAdjustedUrgency,
    dependencyBoost,
    activeHorizon,
  });

  const guarantee = runTimeEngineGuarantee({
    signals,
    temporal,
    prioritySignal,
    inferredDeadlineCreated: false,
  });

  return {
    engine,
    signals,
    temporal,
    ...(memoryOverride ? { memoryOverride } : {}),
    ...(conflict ? { conflict } : {}),
    prioritySignal,
    envelope,
    guarantee,
  };
}

export function applyTimeEngineBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: TimeEngineLayerResult,
): BehaviorProfile {
  return applyBehaviorWeighting(behaviorProfile, layer.envelope);
}

export function applyTimeEngineGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: TimeEngineLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergeTimeEngineWithModuleWeights(
    governance.moduleWeights,
    layer.envelope,
  );

  return {
    ...governance,
    moduleWeights: mergedWeights,
    appliedConstraints: [
      ...governance.appliedConstraints,
      {
        kind: "memory_module_weight",
        detail: `timeEngine horizon=${layer.prioritySignal.activeHorizon} decayUrgency=${layer.prioritySignal.decayAdjustedUrgency.toFixed(2)} dependencyBoost=${layer.prioritySignal.dependencyBoost.toFixed(2)}`,
      },
    ],
  };
}

export function toTimeEngineLayerPayload(layer: TimeEngineLayerResult): TimeEngineLayerPayload {
  return {
    activeHorizon: layer.prioritySignal.activeHorizon,
    urgencyScore: layer.prioritySignal.urgencyScore,
    decayAdjustedUrgency: layer.prioritySignal.decayAdjustedUrgency,
    dependencyBoost: layer.prioritySignal.dependencyBoost,
    missingTime: layer.signals.missingTime,
    strictMode: layer.prioritySignal.strictMode,
    memoryOverrideApplied: Boolean(layer.memoryOverride),
    uncertaintyFlagged: Boolean(layer.conflict?.uncertaintyFlagged),
    envelope: layer.envelope,
  };
}

/**
 * Classification envelope for observation tags — never raw timestamps as LLM facts.
 */
export function formatTimeEngineObservation(layer: TimeEngineLayerResult): string {
  const { prioritySignal, signals, memoryOverride, conflict } = layer;
  const parts = [
    `time_horizon=${prioritySignal.activeHorizon}`,
    `decay_urgency=${prioritySignal.decayAdjustedUrgency.toFixed(2)}`,
    `dependency_boost=${prioritySignal.dependencyBoost.toFixed(2)}`,
  ];
  if (signals.missingTime) {
    parts.push("temporal_state=UNSCHEDULED");
  } else if (signals.explicitTime) {
    parts.push("time_signal=explicit_classified");
  } else if (signals.relativeTime) {
    parts.push("time_signal=relative_classified");
  } else {
    parts.push("time_signal=inferred_classified");
  }
  if (memoryOverride) {
    parts.push(`memory_override_visible=${memoryOverride.visibleClassification}`);
  }
  if (conflict?.uncertaintyFlagged) {
    parts.push("time_uncertainty=true");
  }
  return `time_engine: ${parts.join("; ")}`;
}
