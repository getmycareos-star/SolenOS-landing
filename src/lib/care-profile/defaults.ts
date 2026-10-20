import type { CareProfile, CareProfileState } from "./types";



export const DEFAULT_CARE_PROFILE: CareProfile = {

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

};



export function createDefaultCareProfileState(userId: string): CareProfileState {

  const now = new Date().toISOString();

  return {

    userId,

    currentVersion: 1,

    profile: { ...DEFAULT_CARE_PROFILE },

    history: [

      {

        version: 1,

        profile: { ...DEFAULT_CARE_PROFILE },

        updatedAt: now,

        updateMode: "USER_CONFIRMED",

        confidence: 1,

        reason: "initial default profile",

      },

    ],

    pendingConflicts: [],

    inferenceSignalCounts: {},

  };

}


