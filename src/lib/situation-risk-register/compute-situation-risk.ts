import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { MissingInformationItem } from "../missing-information-queue/types";
import type { TrackedSituation } from "../resolution-engine/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import {
  ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT,
  SITUATION_RISK_DRIVER_WEIGHTS,
} from "./contract-constants";
import { clamp01, clamp0100 } from "./defaults";
import type { BaseRiskLevel, SituationRisk, SituationRiskDrivers } from "./types";

const BASE_RISK_SCORE: Record<BaseRiskLevel, number> = {
  LOW: 20,
  MEDIUM: 45,
  HIGH: 70,
  CRITICAL: 90,
};

function urgencyToUnit(
  careContext?: SituationalCareContext,
  urgencyDetection?: UrgencyDetectionResult,
): { unit: number; base: BaseRiskLevel } {
  const level =
    careContext?.urgencyLevel ??
    (urgencyDetection?.risk_level === "critical"
      ? "CRITICAL"
      : urgencyDetection?.risk_level === "high"
        ? "HIGH"
        : urgencyDetection?.risk_level === "medium"
          ? "MEDIUM"
          : "LOW");

  switch (level) {
    case "CRITICAL":
      return { unit: 1, base: "CRITICAL" };
    case "HIGH":
      return { unit: 0.75, base: "HIGH" };
    case "MEDIUM":
      return { unit: 0.5, base: "MEDIUM" };
    default:
      return { unit: 0.2, base: "LOW" };
  }
}

function medicalSeverityUnit(
  careContext?: SituationalCareContext,
  careProfile?: CareProfile,
  title?: string,
): number {
  let score = 0;
  if (careContext?.situationType === "emergency") score += 0.55;
  else if (careContext?.situationType === "medical_event") score += 0.4;
  else if (careContext?.situationType === "follow_up") score += 0.2;

  if (careProfile?.conditionSignals.medicationReminders) score += 0.15;
  if (careProfile?.conditionSignals.mobilityAssistance) score += 0.1;

  const text = (title ?? "").toLowerCase();
  if (/\b(hospital|er|emergency|seizure|fall|bleeding|chest pain)\b/.test(text)) {
    score += 0.2;
  }
  if (/\b(medication|dose|insulin|prescription)\b/.test(text)) {
    score += 0.1;
  }
  return clamp01(score);
}

function dependencyLevelUnit(
  situation: TrackedSituation,
  careProfile?: CareProfile,
): number {
  const dependents = careProfile?.careRelationships.dependents.length ?? 0;
  const shared = careProfile?.careRelationships.sharedCareWith.length ?? 0;
  const unresolved = situation.unresolvedDependencyIds.length;
  const refs = situation.referencedBySituationIds.length;
  const raw = dependents * 0.2 + shared * 0.12 + unresolved * 0.15 + refs * 0.1;
  return clamp01(raw);
}

function timeSensitivityUnit(
  timeEngine?: TimeEngineLayerResult,
  careContext?: SituationalCareContext,
): number {
  const temporal = timeEngine?.envelope.temporalUrgency ?? 0;
  const pressure =
    careContext?.environmentSignals.timePressure === "high"
      ? 0.35
      : careContext?.environmentSignals.timePressure === "medium"
        ? 0.2
        : careContext?.environmentSignals.timePressure === "low"
          ? 0.1
          : 0;
  return clamp01(temporal + pressure);
}

function uncertaintyFromMissingInfo(
  openItems: readonly MissingInformationItem[],
): number {
  let score = 0;
  for (const item of openItems) {
    if (item.importance === "HIGH") score += 0.22;
    else if (item.importance === "MEDIUM") score += 0.12;
    else score += 0.05;
  }
  return clamp01(score);
}

function baseRiskFromDrivers(
  drivers: SituationRiskDrivers,
  urgencyBase: BaseRiskLevel,
): BaseRiskLevel {
  const w = SITUATION_RISK_DRIVER_WEIGHTS;
  const weighted =
    drivers.urgency * w.urgency +
    drivers.medicalSeverity * w.medicalSeverity +
    drivers.dependencyLevel * w.dependencyLevel +
    drivers.timeSensitivity * w.timeSensitivity +
    drivers.uncertaintyFactor * w.uncertaintyFactor;

  if (urgencyBase === "CRITICAL" || weighted >= 0.85) return "CRITICAL";
  if (urgencyBase === "HIGH" || weighted >= 0.65) return "HIGH";
  if (urgencyBase === "MEDIUM" || weighted >= 0.4) return "MEDIUM";
  return "LOW";
}

/**
 * Compute SituationRisk for a single ACTIVE situation.
 * RESOLVED/ARCHIVED callers must be filtered upstream.
 */
export function computeSituationRisk(params: {
  situation: TrackedSituation;
  careContext?: SituationalCareContext;
  careProfile?: CareProfile;
  timeEngine?: TimeEngineLayerResult;
  urgencyDetection?: UrgencyDetectionResult;
  openMissingInfo?: readonly MissingInformationItem[];
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
}): SituationRisk {
  const { unit: urgency, base: urgencyBase } = urgencyToUnit(
    params.careContext,
    params.urgencyDetection,
  );

  const drivers: SituationRiskDrivers = {
    urgency,
    medicalSeverity: medicalSeverityUnit(
      params.careContext,
      params.careProfile,
      params.situation.title,
    ),
    dependencyLevel: dependencyLevelUnit(params.situation, params.careProfile),
    timeSensitivity: timeSensitivityUnit(params.timeEngine, params.careContext),
    uncertaintyFactor: uncertaintyFromMissingInfo(params.openMissingInfo ?? []),
  };

  const baseRisk = baseRiskFromDrivers(drivers, urgencyBase);
  const w = SITUATION_RISK_DRIVER_WEIGHTS;
  const driverScore =
    drivers.urgency * w.urgency +
    drivers.medicalSeverity * w.medicalSeverity +
    drivers.dependencyLevel * w.dependencyLevel +
    drivers.timeSensitivity * w.timeSensitivity +
    drivers.uncertaintyFactor * w.uncertaintyFactor;

  const floor = BASE_RISK_SCORE[baseRisk];
  let adjustedRisk = floor * 0.45 + driverScore * 100 * 0.55;

  const stale = params.assumptionEnvelope?.staleInfluenceCount ?? 0;
  const bias = params.assumptionEnvelope?.compositeBias ?? 0;
  if (stale > 0 || bias > 0.15) {
    adjustedRisk +=
      (bias * 20 + Math.min(15, stale * 5)) * ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT;
  }

  return {
    situationId: params.situation.id,
    baseRisk,
    adjustedRisk: clamp0100(adjustedRisk),
    riskDrivers: drivers,
  };
}
