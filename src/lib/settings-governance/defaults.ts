import { DEFAULT_TIME_HORIZON_MODEL } from "./contract-constants";

import type { MemoryControl, SolenOSSettings } from "./types";



/** Default memory category weights — used when no explicit weights are set. */

export const DEFAULT_MEMORY_CONTROL_WEIGHTS: Pick<

  MemoryControl,

  | "identityMemoryWeight"

  | "patternMemoryWeight"

  | "operationalMemoryWeight"

  | "emotionalMemoryWeight"

> = {

  identityMemoryWeight: 0.25,

  patternMemoryWeight: 0.25,

  operationalMemoryWeight: 0.3,

  emotionalMemoryWeight: 0,

};



/** Default system settings — conservative-safe baseline for all users. */

export const DEFAULT_SOLENOS_SETTINGS: SolenOSSettings = {

  systemMode: "NORMAL",

  careContext: {

    roleInCareGraph: "primary_caregiver",

    careRelationships: {

      dependents: [],

      sharedCareWith: [],

      externalCaregivers: [],

    },

    conditionSignals: {

      medicationReminders: false,

      mobilityAssistance: false,

    },

    workloadIntensity: "MEDIUM",

    timeSensitivity: "unpredictable",

  },

  memoryControl: {

    ...DEFAULT_MEMORY_CONTROL_WEIGHTS,

    inferenceFromBehavior: false,

    allowMemoryWrite: true,

    allowMemoryRead: true,

  },

  decisionControl: {

    level: "MEDIUM",

    requireConfirmationForHighRisk: true,

    showAlternatives: false,

    reasoningVisibility: "summary",

    manualOverrideEnabled: true,

  },

  timeControl: {

    timezoneDetection: true,

    coarseLocationEnabled: false,

    timeHorizonModel: { ...DEFAULT_TIME_HORIZON_MODEL },

    strictTimeHorizonMode: false,

  },

  emotionalControl: {

    emotionalLoadDetection: true,

    burnoutDetection: true,

    griefSensitivity: true,

    overloadSimplification: true,

    mode: "normal",

  },

  notificationControl: {

    urgencyFilter: "RED_ORANGE",

    quietHoursEnabled: false,

    emergencyOverride: true,

    digestMode: "instant",

  },

  privacyControl: {

    exportEnabled: true,

    deleteAccountEnabled: true,

    disableInferenceEngine: false,

    disableBehaviorSignals: false,

    allowBehaviorInference: false,

  },

  transparencyControl: {

    reasoningVisibility: "summary",

    uncertaintyDisplay: true,

    confidenceDisplay: true,

    showAlternatives: false,

  },

  safetyControl: {

    medicalMode: "advisory_only",

    emergencySensitivity: "normal",

    externalEscalationEnabled: false,

    alwaysShowUncertainty: true,

    noCertaintyMode: false,

    riskTolerance: "LOW",

  },

};


