import type { MemoryControl } from "../settings-governance/types";

import { deriveMemoryVisibility } from "../settings-governance/normalize-settings";

import type { MemoryInfluenceState, SolenOSMemory } from "./types";



export function createDefaultSolenOSMemory(

  memoryControl?: MemoryControl,

): SolenOSMemory {

  const control = memoryControl;

  return {

    identityMemory: { entries: [] },

    longTermPatternMemory: { entries: [] },

    operationalMemory: { entries: [] },

    emotionalMemory: { entries: [] },

    memoryWeights: {

      identity: control?.identityMemoryWeight ?? 0,

      patterns: control?.patternMemoryWeight ?? 0,

      operational: control?.operationalMemoryWeight ?? 0,

      emotional: control?.emotionalMemoryWeight ?? 0,

    },

    visibility: control ? deriveMemoryVisibility(control) : "summary",

    taggingSystem: {

      outdated: true,

      incorrect: true,

      sensitive: true,

    },

    deletionPolicy: {

      allowFullDelete: true,

      allowCategoryDelete: true,

      allowSelectiveForget: true,

    },

    inferenceFromBehavior: control?.inferenceFromBehavior ?? false,

  };

}



export function createDefaultMemoryInfluenceState(

  userId: string,

  memoryControl?: MemoryControl,

): MemoryInfluenceState {

  return {

    userId,

    memory: createDefaultSolenOSMemory(memoryControl),

    signalOccurrenceCounts: {},

    deletionLog: [],

  };

}


