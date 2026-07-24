import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { CaregiverDepletionSignalsResult } from "../caregiver-depletion-signals";
import type {
  MemoryInfluenceEnvelope,
  MemoryInfluenceState,
} from "../memory-influence/types";
import type { AssumptionInfluenceEnvelope } from "../assumption-registry/types";
import type { MissingInformationInfluenceEnvelope } from "../missing-information-queue/types";
import type { SolenOSSettings } from "../settings-governance/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import type { EmotionalLoadSignalLayerResult } from "../emotional-load-signal";
import type {
  PriorityActionCandidate,
  PriorityDomain,
} from "./types";

function roleSeverity(role: CareProfile["roleInCareGraph"]): number {
  switch (role) {
    case "primary_caregiver":
      return 1.2;
    case "shared_caregiver":
      return 1.05;
    case "secondary_caregiver":
      return 0.9;
    case "observer":
      return 0.5;
    default:
      return 1;
  }
}

function workloadSeverity(workload: CareProfile["workloadIntensity"]): number {
  switch (workload) {
    case "HIGH":
      return 1.2;
    case "MEDIUM":
      return 1;
    case "LOW":
      return 0.85;
    default:
      return 1;
  }
}

function mapUrgencyClass(
  careContext?: SituationalCareContext,
  timeLayer?: TimeEngineLayerResult,
): PriorityActionCandidate["urgencyClass"] {
  if (careContext?.urgencyLevel) return careContext.urgencyLevel;
  if (timeLayer?.signals.missingTime) return "UNSCHEDULED";
  const horizon = timeLayer?.prioritySignal.activeHorizon;
  if (horizon === "NOW") return "CRITICAL";
  if (horizon === "TODAY") return "HIGH";
  if (horizon === "SOON") return "MEDIUM";
  if (horizon === "LATER") return "LOW";
  return "UNSCHEDULED";
}

function domainFromSituation(
  careContext?: SituationalCareContext,
  urgency?: UrgencyDetectionResult,
): PriorityDomain {
  const situation = careContext?.situationType;
  if (situation === "emergency" || situation === "medical_event") return "medical";
  if (situation === "administrative") return "financial";
  if (urgency?.risk_level === "critical" || urgency?.risk_level === "high") {
    return "medical";
  }
  if (situation === "follow_up") return "care_coordination";
  if (situation === "uncertain_state") return "unknown";
  return "operational";
}

function medicalRiskFromSignals(
  urgency?: UrgencyDetectionResult,
  careContext?: SituationalCareContext,
  careProfile?: CareProfile,
): number {
  let risk = 0;
  if (urgency?.risk_level === "critical") risk = 0.9;
  else if (urgency?.risk_level === "high") risk = 0.7;
  else if (urgency?.risk_level === "medium") risk = 0.4;
  else if (urgency?.risk_level === "low") risk = 0.15;

  if (careContext?.situationType === "emergency") risk = Math.max(risk, 0.95);
  if (careContext?.urgencyLevel === "CRITICAL") risk = Math.max(risk, 0.85);
  if (careProfile?.conditionSignals.medicationReminders) risk = Math.max(risk, 0.35);
  if (careProfile?.conditionSignals.mobilityAssistance) risk = Math.max(risk, 0.3);
  return Math.min(1, risk);
}

function financialRiskFromContext(careContext?: SituationalCareContext): number {
  if (careContext?.situationType === "administrative") return 0.55;
  if (careContext?.unresolvedItems.some((i) => /bill|cost|insurance|financ/i.test(i))) {
    return 0.55;
  }
  return 0.1;
}

function entryRecency(updatedAt: string, nowMs: number): number {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0.3;
  const days = Math.max(0, (nowMs - t) / (1000 * 60 * 60 * 24));
  // Decay: recent → 1, older → lower
  return Math.max(0.05, Math.exp(-days / 30));
}

/**
 * Derive scoreable action candidates from upstream layers.
 * READS signals only — does not merge layers or generate NL actions.
 */
export function derivePriorityCandidates(params: {
  timeEngine: TimeEngineLayerResult;
  memoryState?: MemoryInfluenceState;
  memoryEnvelope?: MemoryInfluenceEnvelope;
  assumptionEnvelope?: AssumptionInfluenceEnvelope;
  missingInformationEnvelope?: MissingInformationInfluenceEnvelope;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  depletion?: CaregiverDepletionSignalsResult;
  urgencyDetection?: UrgencyDetectionResult;
  governanceSettings?: SolenOSSettings;
  emotionalLoadSignal?: EmotionalLoadSignalLayerResult;
  nowMs?: number;
}): PriorityActionCandidate[] {
  const {
    timeEngine,
    memoryState,
    memoryEnvelope,
    assumptionEnvelope,
    missingInformationEnvelope,
    careProfile,
    careContext,
    depletion,
    urgencyDetection,
    governanceSettings,
    emotionalLoadSignal,
  } = params;
  const nowMs = params.nowMs ?? Date.now();

  const temporalUrgency = Math.min(
    1,
    timeEngine.envelope.temporalUrgency + (assumptionEnvelope?.compositeBias ?? 0) * 0.15,
  );
  const missingTime = timeEngine.signals.missingTime;
  const conflictingSignals = Boolean(timeEngine.conflict?.uncertaintyFlagged);
  const urgencyClass = mapUrgencyClass(careContext, timeEngine);
  const assumptionUncertaintyBoost =
    (assumptionEnvelope?.staleInfluenceCount ?? 0) > 0
      ? Math.min(0.25, (assumptionEnvelope?.staleInfluenceCount ?? 0) * 0.08)
      : 0;

  const dependents = careProfile?.careRelationships.dependents ?? [];
  const shared = careProfile?.careRelationships.sharedCareWith ?? [];
  const external = careProfile?.careRelationships.externalCaregivers ?? [];
  const severity =
    (careProfile
      ? roleSeverity(careProfile.roleInCareGraph) * workloadSeverity(careProfile.workloadIntensity)
      : 1) * (1 + timeEngine.prioritySignal.dependencyBoost);

  const burnoutDetectionOn =
    governanceSettings?.emotionalControl.burnoutDetection !== false;
  const griefSensitivityOn =
    governanceSettings?.emotionalControl.griefSensitivity === true;

  const burnout =
    burnoutDetectionOn &&
    (depletion?.caregiver_depletion_state === "critical" ||
      depletion?.caregiver_depletion_state === "elevated" ||
      (emotionalLoadSignal?.signal.burnoutProbability.value ?? 0) >= 0.55);

  const grief =
    griefSensitivityOn &&
    (depletion?.caregiver_depletion_state === "critical" ||
      careContext?.situationType === "uncertain_state");

  const emotionalLoadDetectionOn =
    governanceSettings?.emotionalControl.emotionalLoadDetection !== false;

  const signalBoost =
    emotionalLoadDetectionOn && emotionalLoadSignal?.detectionEnabled
      ? emotionalLoadSignal.signal.burnoutProbability.value * 0.35 +
        (emotionalLoadSignal.signal.compositeScore / 100) * 0.25
      : 0;

  const emotionalLoad = Math.min(
    1,
    (memoryEnvelope?.emotionalBias ?? 0) +
      (depletion?.caregiver_depletion_state === "critical"
        ? 0.7
        : depletion?.caregiver_depletion_state === "elevated"
          ? 0.45
          : 0.1) +
      signalBoost,
  );

  // Use care context emotional sensitivity as vulnerability proxy when present.
  const vulnerabilityFactor = Math.min(
    1.5,
    0.8 +
      (depletion?.is_single_caregiver ? 0.25 : 0) +
      (memoryEnvelope?.emotionalBias ?? 0) * 0.5,
  );

  const medicalRisk = medicalRiskFromSignals(urgencyDetection, careContext, careProfile);
  const financialRisk = financialRiskFromContext(careContext);
  const uncertaintyRisk = Math.min(
    1,
    (missingTime ? 0.35 : 0) +
      (conflictingSignals ? 0.3 : 0) +
      assumptionUncertaintyBoost +
      (missingInformationEnvelope?.uncertaintyBoost ?? 0) +
      (careContext?.userIntentSignal.confidence !== undefined
        ? 1 - careContext.userIntentSignal.confidence
        : 0.2) *
        0.4,
  );

  const lowDependencyClarity =
    dependents.length === 0 &&
    (careProfile?.roleInCareGraph === "primary_caregiver" ||
      careProfile?.roleInCareGraph === "shared_caregiver");

  const highPriorityGaps =
    (missingInformationEnvelope?.highPriorityOpenCount ?? 0) > 0;

  const baseEmotional = {
    emotionalLoad,
    vulnerabilityFactor,
    burnout: Boolean(burnout),
    grief: Boolean(grief),
  };

  const baseDependency = {
    dependents,
    sharedCareWith: shared,
    externalCaregivers: external,
    dependencySeverityMultiplier: severity,
  };

  const baseMissing = {
    missingTime,
    missingMemory: !memoryState || memoryEnvelope?.compositeInfluence === 0,
    conflictingSignals,
    lowDependencyClarity,
    highPriorityGaps,
  };

  const candidates: PriorityActionCandidate[] = [];

  // Primary situational vector — domain from care context / urgency.
  const primaryDomain = domainFromSituation(careContext, urgencyDetection);
  candidates.push({
    actionId: `signal:primary:${primaryDomain}`,
    domain: primaryDomain,
    urgencyClass,
    temporalUrgency,
    emotional: baseEmotional,
    memory: {
      frequency: Math.min(1, (memoryEnvelope?.compositeInfluence ?? 0) + 0.2),
      recency: missingTime ? 0.4 : 0.8,
      importanceDecay: Math.max(0.2, 1 - (memoryEnvelope?.emotionalBias ?? 0) * 0.3),
    },
    dependency: baseDependency,
    risk: { medicalRisk, financialRisk, uncertaintyRisk },
    missingSignals: baseMissing,
  });

  // Unresolved care-context items — structured ids only (no NL generation).
  for (const [index, item] of (careContext?.unresolvedItems ?? []).slice(0, 5).entries()) {
    const isFinancial = /bill|cost|insurance|financ/i.test(item);
    const isMedical = /med|hospital|symptom|pain|doctor|appoint/i.test(item);
    const domain: PriorityDomain = isFinancial
      ? "financial"
      : isMedical
        ? "medical"
        : "operational";
    candidates.push({
      actionId: `signal:unresolved:${index}:${domain}`,
      domain,
      urgencyClass: careContext?.urgencyLevel ?? urgencyClass,
      temporalUrgency: Math.min(1, temporalUrgency + 0.05),
      emotional: baseEmotional,
      memory: {
        frequency: 0.4,
        recency: 0.7,
        importanceDecay: 0.8,
      },
      dependency: baseDependency,
      risk: {
        medicalRisk: isMedical ? Math.max(medicalRisk, 0.5) : medicalRisk * 0.6,
        financialRisk: isFinancial ? Math.max(financialRisk, 0.6) : financialRisk,
        uncertaintyRisk,
      },
      missingSignals: baseMissing,
    });
  }

  // Memory operational / pattern reinforcement candidates.
  if (memoryState) {
    const operational = memoryState.memory.operationalMemory.entries
      .filter((e) => !e.tags.outdated && !e.tags.incorrect)
      .slice(0, 4);
    for (const entry of operational) {
      const freq = Math.min(1, entry.occurrenceCount / 10);
      candidates.push({
        actionId: `signal:memory:operational:${entry.id}`,
        domain: "operational",
        urgencyClass,
        temporalUrgency: temporalUrgency * 0.9,
        emotional: {
          ...baseEmotional,
          emotionalLoad: Math.min(1, baseEmotional.emotionalLoad * 0.7),
        },
        memory: {
          frequency: freq,
          recency: entryRecency(entry.updatedAt, nowMs),
          importanceDecay: entry.confidence,
        },
        dependency: baseDependency,
        risk: {
          medicalRisk: medicalRisk * 0.5,
          financialRisk: financialRisk * 0.4,
          uncertaintyRisk: Math.min(1, uncertaintyRisk + (1 - entry.confidence) * 0.2),
        },
        missingSignals: {
          ...baseMissing,
          missingMemory: false,
        },
      });
    }

    const patterns = memoryState.memory.longTermPatternMemory.entries
      .filter((e) => !e.tags.outdated && !e.tags.incorrect && e.occurrenceCount >= 2)
      .slice(0, 3);
    for (const entry of patterns) {
      candidates.push({
        actionId: `signal:memory:pattern:${entry.id}`,
        domain: "care_coordination",
        urgencyClass,
        temporalUrgency: temporalUrgency * 0.85,
        emotional: baseEmotional,
        memory: {
          frequency: Math.min(1, entry.occurrenceCount / 8),
          recency: entryRecency(entry.updatedAt, nowMs),
          importanceDecay: entry.confidence * entry.influenceWeight,
        },
        dependency: baseDependency,
        risk: {
          medicalRisk: medicalRisk * 0.4,
          financialRisk: 0.1,
          uncertaintyRisk,
        },
        missingSignals: { ...baseMissing, missingMemory: false },
      });
    }
  }

  // Explicit dependency-care vector when dependents exist (multi-user, not collapsed).
  if (dependents.length > 0) {
    candidates.push({
      actionId: `signal:dependency:care-graph:${dependents.length}`,
      domain: "care_coordination",
      urgencyClass,
      temporalUrgency: Math.min(1, temporalUrgency + timeEngine.prioritySignal.dependencyBoost),
      emotional: baseEmotional,
      memory: {
        frequency: memoryEnvelope?.operationalBias ?? 0.3,
        recency: 0.6,
        importanceDecay: 0.75,
      },
      dependency: baseDependency,
      risk: {
        medicalRisk: medicalRisk * 0.7,
        financialRisk,
        uncertaintyRisk: lowDependencyClarity ? Math.min(1, uncertaintyRisk + 0.2) : uncertaintyRisk,
      },
      missingSignals: baseMissing,
    });
  }

  // Assumption registry soft bias — influence only, not facts.
  if (assumptionEnvelope && assumptionEnvelope.influenceableCount > 0) {
    candidates.push({
      actionId: `signal:assumption:registry:${assumptionEnvelope.influenceableCount}`,
      domain: domainFromSituation(careContext, urgencyDetection),
      urgencyClass,
      temporalUrgency: Math.min(1, temporalUrgency + assumptionEnvelope.compositeBias * 0.2),
      emotional: baseEmotional,
      memory: {
        frequency: assumptionEnvelope.compositeBias,
        recency: assumptionEnvelope.staleInfluenceCount > 0 ? 0.4 : 0.75,
        importanceDecay: 0.6,
      },
      dependency: baseDependency,
      risk: {
        medicalRisk: medicalRisk * 0.5,
        financialRisk: financialRisk * 0.5,
        uncertaintyRisk: Math.min(1, uncertaintyRisk + assumptionUncertaintyBoost),
      },
      missingSignals: {
        ...baseMissing,
        missingMemory: false,
      },
    });
  }

  // Deterministic order of candidates by actionId for stable fusion input.
  candidates.sort((a, b) => a.actionId.localeCompare(b.actionId));
  return candidates;
}
