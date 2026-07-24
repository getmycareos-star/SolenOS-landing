import type { CareProfileLayerPayload } from "../care-profile/types";
import type { CareContextLayerPayload } from "../care-context/situational/types";
import type { MemoryInfluenceLayerPayload } from "../memory-influence/types";
import type { SafetyLayerPayload } from "../safety-enforcement/types";
import type { GovernanceLayerPayload } from "../settings-governance/types";
import type { SystemHealthLayerPayload } from "../system-health/types";
import { toUiRuntimeSystemHealthView } from "../system-health/view-model";
import type { AssumptionRegistryLayerPayload } from "../assumption-registry/types";
import { toAssumptionRegistryView } from "../assumption-registry/view-model";
import type { MissingInformationQueueLayerPayload } from "../missing-information-queue/types";
import { toMissingInformationQueueView } from "../missing-information-queue/view-model";
import type { ResponsibilityGraphLayerPayload } from "../responsibility-graph/types";
import { DEFAULT_SOLENOS_SETTINGS } from "../settings-governance/defaults";
import { ABOUT_SOLENOS_SECTIONS } from "../trust-content";
import {
  FORBIDDEN_UI_PATTERNS,
  UI_RUNTIME_DESIGN_PRINCIPLE,
  UI_RUNTIME_IDENTITY,
} from "./contract-constants";
import type {
  AboutSolenOSView,
  CareContextView,
  CareProfileView,
  MemoryView,
  ResponsibilityGraphView,
  SafetySettingsView,
  SystemHealthView,
  SystemSettingsView,
} from "./types";

export function buildCareProfileView(
  layer?: CareProfileLayerPayload | null,
): CareProfileView {
  if (!layer) {
    const d = DEFAULT_SOLENOS_SETTINGS.careContext;
    return {
      roleInCareGraph: d.roleInCareGraph,
      careRelationships: { ...d.careRelationships },
      caregivingPermissions: ["operational_guidance"],
      delegationRights: d.careRelationships.sharedCareWith.length > 0 ? ["shared_care"] : [],
      workloadIntensity: d.workloadIntensity,
      timeSensitivity: d.timeSensitivity,
      source: "defaults",
    };
  }

  return {
    roleInCareGraph: layer.roleInCareGraph,
    careRelationships: {
      dependents: [],
      sharedCareWith: [],
      externalCaregivers: [],
    },
    caregivingPermissions: ["operational_guidance"],
    delegationRights: [],
    workloadIntensity: layer.workloadIntensity,
    timeSensitivity: layer.timeSensitivity,
    pendingConflictCount: layer.pendingConflictCount,
    source: "care_profile_layer",
  };
}

export function enrichCareProfileFromDefaults(
  view: CareProfileView,
  relationships?: {
    dependents: string[];
    sharedCareWith: string[];
    externalCaregivers: string[];
  },
): CareProfileView {
  if (!relationships) return view;
  return {
    ...view,
    careRelationships: relationships,
    delegationRights:
      relationships.sharedCareWith.length > 0 || relationships.externalCaregivers.length > 0
        ? ["shared_care", "external_delegation"]
        : view.delegationRights,
  };
}

export function buildCareContextView(params: {
  careContextLayer?: CareContextLayerPayload | null;
  careProfileLayer?: CareProfileLayerPayload | null;
  profileRelationships?: CareProfileView["careRelationships"];
  assumptionRegistryLayer?: AssumptionRegistryLayerPayload | null;
  missingInformationQueueLayer?: MissingInformationQueueLayerPayload | null;
  /** Single conflict clarification — never a count dump. */
  conflictClarification?: CareContextView["conflictClarification"];
}): CareContextView {
  const {
    careContextLayer,
    careProfileLayer,
    profileRelationships,
    assumptionRegistryLayer,
    missingInformationQueueLayer,
    conflictClarification = null,
  } = params;
  const assumptionView = toAssumptionRegistryView(assumptionRegistryLayer);
  const currentAssumptions = assumptionView.items.map((i) => ({
    summary: i.summary,
    status: i.status,
  }));
  const miView = toMissingInformationQueueView(missingInformationQueueLayer);
  const informationNeeded = miView.items.map((i) => ({
    question: i.question,
    importance: i.importance,
  }));

  if (!careContextLayer && !careProfileLayer) {
    return {
      dependentProfiles: profileRelationships?.dependents ?? [],
      conditions: [],
      medications: [],
      careConstraints: [],
      environmentalFactors: [],
      currentAssumptions,
      informationNeeded,
      conflictClarification: conflictClarification ?? null,
      source: "stub",
    };
  }

  const conditions: string[] = [];
  const medications: string[] = [];
  if (careProfileLayer) {
    // Payload omits conditionSignals detail — summarize from workload/time when present.
    if (careProfileLayer.workloadIntensity === "HIGH") {
      conditions.push("High caregiving workload intensity");
    }
  }

  const environmentalFactors: string[] = [];
  if (careContextLayer?.locationContext) {
    environmentalFactors.push(`Location: ${careContextLayer.locationContext}`);
  }
  if (careContextLayer?.timePressure) {
    environmentalFactors.push(`Time pressure: ${careContextLayer.timePressure}`);
  }
  if (careContextLayer?.interruptionRisk) {
    environmentalFactors.push(`Interruption risk: ${careContextLayer.interruptionRisk}`);
  }

  const careConstraints: string[] = [];
  if (careContextLayer && careContextLayer.constraintCount > 0) {
    careConstraints.push(`${careContextLayer.constraintCount} active constraint(s)`);
  }

  return {
    dependentProfiles: profileRelationships?.dependents ?? [],
    conditions,
    medications,
    careConstraints,
    environmentalFactors,
    situationType: careContextLayer?.situationType,
    urgencyLevel: careContextLayer?.urgencyLevel,
    currentAssumptions,
    informationNeeded,
    conflictClarification: conflictClarification ?? null,
    source: careContextLayer ? "care_context_layer" : "care_profile_layer",
  };
}

export function buildMemoryView(layer?: MemoryInfluenceLayerPayload | null): MemoryView {
  if (!layer) {
    return {
      identityMemory: [],
      patternMemory: [],
      operationalMemory: [],
      correctionMemory: [],
      source: "stub",
    };
  }

  // Summaries only — never dump raw memory entries.
  const hints = layer.envelope.interpretationHints ?? [];
  return {
    identityMemory: hints.filter((h) => /identity|role|caregiver/i.test(h)).slice(0, 3),
    patternMemory: hints.filter((h) => /pattern|repeat|habit/i.test(h)).slice(0, 3),
    operationalMemory: hints.filter((h) => /operational|process|procedure/i.test(h)).slice(0, 3),
    correctionMemory: hints.filter((h) => /correct|outdated|incorrect/i.test(h)).slice(0, 3),
    compositeInfluence: layer.compositeInfluence,
    activeEntryCount: layer.activeEntryCount,
    source: "memory_influence_layer",
  };
}

export function buildResponsibilityGraphView(
  profile: CareProfileView,
  layer?: ResponsibilityGraphLayerPayload | null,
): ResponsibilityGraphView {
  if (layer) {
    return {
      owner: layer.primaryOwnerName ?? "Unassigned",
      delegates: profile.careRelationships.externalCaregivers,
      sharedCaregivers: profile.careRelationships.sharedCareWith,
      unresolvedOwnershipConflicts:
        layer.conflictCount > 0
          ? layer.influenceHints
              .filter((h) => h.startsWith("ownership_conflict"))
              .concat(
                layer.criticalUnassignedCount > 0
                  ? [`${layer.criticalUnassignedCount} high-pressure unassigned`]
                  : [],
              )
          : layer.criticalUnassignedCount > 0
            ? [`${layer.criticalUnassignedCount} high-pressure unassigned`]
            : [],
      health: layer.health,
      unassignedCount: layer.unassignedCount,
      criticalUnassignedCount: layer.criticalUnassignedCount,
      escalate: layer.escalate,
      source: "responsibility_graph_layer",
    };
  }
  return {
    owner: profile.roleInCareGraph,
    delegates: profile.careRelationships.externalCaregivers,
    sharedCaregivers: profile.careRelationships.sharedCareWith,
    unresolvedOwnershipConflicts:
      profile.pendingConflictCount && profile.pendingConflictCount > 0
        ? [`${profile.pendingConflictCount} pending ownership conflict(s)`]
        : [],
    source: profile.source === "stub" ? "stub" : "care_profile_layer",
  };
}

export function buildSafetySettingsView(params: {
  safetyLayer?: SafetyLayerPayload | null;
  assumptionRegistryLayer?: AssumptionRegistryLayerPayload | null;
}): SafetySettingsView {
  const defaults = DEFAULT_SOLENOS_SETTINGS.safetyControl;
  const layer = params.safetyLayer;
  const assumptionView = toAssumptionRegistryView(params.assumptionRegistryLayer);
  const currentAssumptions = assumptionView.items.map((i) => ({
    summary: i.summary,
    status: i.status,
  }));

  if (!layer) {
    return {
      uncertaintyDisplay: defaults.alwaysShowUncertainty,
      medicalAdvisoryMode: defaults.medicalMode,
      riskSensitivity: defaults.riskTolerance,
      escalationRules: defaults.externalEscalationEnabled
        ? ["external_escalation_enabled"]
        : ["local_advisory_only"],
      currentAssumptions,
      source: "defaults",
    };
  }

  return {
    uncertaintyDisplay: true,
    medicalAdvisoryMode: layer.medicalMode,
    riskSensitivity: layer.emergencySensitivity,
    escalationRules: [
      `escalation_action=${layer.escalationAction}`,
      ...(layer.emergencyOverrideActive ? ["emergency_override_active"] : []),
      ...layer.appliedConstraints.map((c) => c.kind),
    ],
    currentAssumptions,
    source: "safety_layer",
  };
}

export function buildSystemSettingsView(params: {
  governanceLayer?: GovernanceLayerPayload | null;
  languagePreference: string;
}): SystemSettingsView {
  const { governanceLayer, languagePreference } = params;
  if (!governanceLayer) {
    const s = DEFAULT_SOLENOS_SETTINGS;
    return {
      memoryBehavior: s.memoryControl.allowMemoryWrite ? "read_write" : "read_only",
      decisionAuthority: s.decisionControl.level,
      timeEngineBehavior: s.timeControl.strictTimeHorizonMode ? "strict" : "adaptive",
      systemMode: s.systemMode,
      languagePreference,
      source: "defaults",
    };
  }

  return {
    memoryBehavior: governanceLayer.moduleActivation.memory ? "active" : "gated",
    decisionAuthority: governanceLayer.routing.decisionAutonomy,
    timeEngineBehavior: governanceLayer.moduleActivation.time ? "active" : "gated",
    systemMode: governanceLayer.systemMode,
    languagePreference,
    source: "governance_layer",
  };
}

export function buildSystemHealthView(params: {
  unresolvedQuestions: number;
  memory?: MemoryView;
  careContext?: CareContextView;
  pendingConflicts?: number;
  systemHealthLayer?: SystemHealthLayerPayload | null;
  assumptionRegistryLayer?: AssumptionRegistryLayerPayload | null;
  missingInformationQueueLayer?: MissingInformationQueueLayerPayload | null;
  confidenceLayer?: import("../confidence-layer").ConfidenceLayerPayload | null;
}): SystemHealthView {
  const {
    unresolvedQuestions,
    memory,
    careContext,
    pendingConflicts = 0,
    systemHealthLayer,
    assumptionRegistryLayer,
    missingInformationQueueLayer,
    confidenceLayer,
  } = params;

  const assumptionView = toAssumptionRegistryView(assumptionRegistryLayer);
  const assumptionItems = assumptionView.items.map((i) => ({
    summary: i.summary,
    status: i.status,
  }));
  const miView = toMissingInformationQueueView(missingInformationQueueLayer);

  if (systemHealthLayer) {
    const fromLayer = toUiRuntimeSystemHealthView(systemHealthLayer);
    return {
      ...fromLayer,
      band: systemHealthLayer.band,
      overallHealthScore: systemHealthLayer.overallHealthScore,
      issueBullets: systemHealthLayer.issueBullets,
      userFacingSummary: systemHealthLayer.userFacingSummary,
      assumptionHealth:
        systemHealthLayer.health.assumptionQuality ?? assumptionView.health,
      currentAssumptions: assumptionItems,
      missingInformationHealth:
        systemHealthLayer.health.missingInformationQuality ?? miView.health,
      highPriorityGaps: miView.needsNext.filter((_, i) =>
        miView.items[i]?.importance === "HIGH" ||
        (systemHealthLayer.health.missingInformationQuality?.highPriorityItems ?? 0) > 0,
      ).slice(0, 5),
      reasoningQualityWarning: miView.criticalWarning,
      caregiverConfidenceExplanation: confidenceLayer?.explanation,
      caregiverConfidenceScore: confidenceLayer?.confidence,
      source: "system_health_layer",
    };
  }

  const contextSignals =
    (careContext?.careConstraints.length ?? 0) +
    (careContext?.environmentalFactors.length ?? 0);
  const contextCompleteness =
    contextSignals === 0 ? "incomplete" : contextSignals < 3 ? "partial" : "adequate";

  return {
    confidenceDrift: "stable",
    contextCompleteness,
    memoryQuality:
      memory?.source === "stub"
        ? "unavailable"
        : (memory?.activeEntryCount ?? 0) > 0
          ? "summarized"
          : "empty",
    contradictionCount: pendingConflicts,
    staleDocuments: 0,
    unresolvedQuestions,
    assumptionHealth: assumptionView.health,
    currentAssumptions: assumptionItems,
    missingInformationHealth: miView.health,
    highPriorityGaps: miView.needsNext.slice(0, 5),
    reasoningQualityWarning: miView.criticalWarning,
    caregiverConfidenceExplanation: confidenceLayer?.explanation,
    caregiverConfidenceScore: confidenceLayer?.confidence,
    source: memory?.source === "stub" && careContext?.source === "stub" ? "stub" : "derived",
  };
}

export function buildAboutSolenOSView(): AboutSolenOSView {
  return {
    identity: UI_RUNTIME_IDENTITY,
    principle: UI_RUNTIME_DESIGN_PRINCIPLE,
    notProductOf: [...FORBIDDEN_UI_PATTERNS],
    sections: ABOUT_SOLENOS_SECTIONS.map((s) => {
      const base = {
        id: s.id,
        title: s.title,
        body: [...s.body],
      };
      if ("linkHref" in s && s.linkHref && "linkLabel" in s && s.linkLabel) {
        return { ...base, linkHref: s.linkHref, linkLabel: s.linkLabel };
      }
      return base;
    }),
  };
}

