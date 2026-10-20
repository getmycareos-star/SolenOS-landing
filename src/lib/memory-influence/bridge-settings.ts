import type { MemoryControl } from "../settings-governance/types";

import { deriveMemoryVisibility } from "../settings-governance/normalize-settings";

import type { SolenOSMemory } from "./types";



/**

 * Read system memory control constraints for memory layer — does NOT merge settings into storage.

 */

export function readMemoryControlConstraints(

  memoryControl: MemoryControl,

): Pick<

  SolenOSMemory,

  "memoryWeights" | "visibility" | "taggingSystem" | "deletionPolicy" | "inferenceFromBehavior"

> {

  return {

    memoryWeights: {

      identity: memoryControl.identityMemoryWeight,

      patterns: memoryControl.patternMemoryWeight,

      operational: memoryControl.operationalMemoryWeight,

      emotional: memoryControl.emotionalMemoryWeight,

    },

    visibility: deriveMemoryVisibility(memoryControl),

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

    inferenceFromBehavior: memoryControl.inferenceFromBehavior,

  };

}



/** @deprecated Use readMemoryControlConstraints */

export const readMemoryGovernanceConstraints = readMemoryControlConstraints;



export function applyMemoryControlConstraints(

  memory: SolenOSMemory,

  memoryControl: MemoryControl,

): SolenOSMemory {

  const constraints = readMemoryControlConstraints(memoryControl);

  return {

    ...memory,

    ...constraints,

  };

}



/** @deprecated Use applyMemoryControlConstraints */

export const applyMemoryGovernanceConstraints = applyMemoryControlConstraints;


