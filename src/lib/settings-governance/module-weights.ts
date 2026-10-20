import type {

  GovernanceRoutingContext,

  ModuleActivationState,

  ModuleWeights,

  SolenOSSettings,

} from "./types";

import {

  deriveMemoryVisibility,

  memoryControlHasActiveWeights,

} from "./normalize-settings";



/**

 * Derive module activation flags from system settings.

 * Controls which pipeline modules influence output routing — not reasoning inputs.

 */

export function computeModuleActivation(settings: SolenOSSettings): ModuleActivationState {

  const { memoryControl, emotionalControl, timeControl, privacyControl, notificationControl } =

    settings;



  const memoryActive =

    !privacyControl.disableInferenceEngine && memoryControlHasActiveWeights(memoryControl);



  return {

    memory: memoryActive,

    emotional:

      emotionalControl.emotionalLoadDetection || emotionalControl.burnoutDetection,

    time: timeControl.timezoneDetection || timeControl.strictTimeHorizonMode,

    priority: true,

    safety: true,

    notification:

      notificationControl.urgencyFilter !== "ALL" || notificationControl.quietHoursEnabled,

  };

}



/**

 * Derive module weighting from system settings.

 * Weights are used for output routing constraints only — never passed to reasoning.

 */

export function computeModuleWeights(

  settings: SolenOSSettings,

  activation: ModuleActivationState,

): ModuleWeights {

  const { memoryControl, emotionalControl, systemMode } = settings;

  const memoryVisibility = deriveMemoryVisibility(memoryControl);



  let memoryWeight = 0;

  if (activation.memory) {

    memoryWeight += memoryControl.identityMemoryWeight;

    memoryWeight += memoryControl.patternMemoryWeight;

    memoryWeight += memoryControl.operationalMemoryWeight;

    memoryWeight += memoryControl.emotionalMemoryWeight;

    if (memoryVisibility === "hidden") memoryWeight *= 0.5;

    if (memoryVisibility === "full") memoryWeight *= 1.2;

  }



  let emotionalWeight = activation.emotional ? 1 : 0;

  if (emotionalControl.mode === "simplify") emotionalWeight *= 1.5;

  if (emotionalControl.mode === "full") emotionalWeight *= 0.8;



  let timeWeight = activation.time ? 1 : 0.5;

  if (settings.timeControl.strictTimeHorizonMode) timeWeight *= 1.3;



  let priorityWeight = 1;

  let safetyWeight = 1;

  let notificationWeight = activation.notification ? 1 : 0.5;



  switch (systemMode) {

    case "CONSERVATIVE":

      safetyWeight = 1.5;

      priorityWeight = 0.8;

      break;

    case "AUTONOMOUS":

      priorityWeight = 1.3;

      safetyWeight = 0.9;

      break;

    case "CRISIS":

      safetyWeight = 2;

      emotionalWeight *= 1.4;

      notificationWeight = 1.5;

      break;

    default:

      break;

  }



  return {

    memory: clampWeight(memoryWeight),

    emotional: clampWeight(emotionalWeight),

    time: clampWeight(timeWeight),

    priority: clampWeight(priorityWeight),

    safety: clampWeight(safetyWeight),

    notification: clampWeight(notificationWeight),

  };

}



/**

 * Derive routing context envelope from settings and computed weights.

 */

export function computeGovernanceRouting(

  settings: SolenOSSettings,

  weights: ModuleWeights,

): GovernanceRoutingContext {

  const {

    systemMode,

    decisionControl,

    transparencyControl,

    memoryControl,

    notificationControl,

    safetyControl,

  } = settings;



  let inferenceDepth: GovernanceRoutingContext["inferenceDepth"] = "standard";

  let riskTolerance: GovernanceRoutingContext["riskTolerance"] = "medium";

  let decisionAutonomy = decisionControl.level;



  switch (systemMode) {

    case "CONSERVATIVE":

      inferenceDepth = "shallow";

      riskTolerance = "low";

      decisionAutonomy = decisionAutonomy === "HIGH" ? "MEDIUM" : decisionAutonomy;

      break;

    case "AUTONOMOUS":

      inferenceDepth = "deep";

      riskTolerance = "high";

      break;

    case "CRISIS":

      inferenceDepth = "shallow";

      riskTolerance = "low";

      decisionAutonomy = "LOW";

      break;

    default:

      inferenceDepth = weights.memory > 0.5 ? "standard" : "shallow";

      break;

  }



  const safetyRiskMap: Record<string, GovernanceRoutingContext["riskTolerance"]> = {

    LOW: "low",

    MEDIUM: "medium",

    HIGH: "high",

  };

  if (systemMode === "NORMAL" || systemMode === "AUTONOMOUS") {

    riskTolerance = safetyRiskMap[safetyControl.riskTolerance] ?? riskTolerance;

  }



  const notificationEligible =

    notificationControl.emergencyOverride ||

    notificationControl.urgencyFilter !== "RED" ||

    !notificationControl.quietHoursEnabled;



  return {

    inferenceDepth,

    riskTolerance,

    decisionAutonomy,

    notificationEligible,

    memoryInfluenceLevel: deriveMemoryVisibility(memoryControl),

    transparencyRouting: {

      reasoningVisibility: transparencyControl.reasoningVisibility,

      uncertaintyDisplay:

        transparencyControl.uncertaintyDisplay || settings.safetyControl.alwaysShowUncertainty,

      confidenceDisplay: transparencyControl.confidenceDisplay,

      showAlternatives:

        transparencyControl.showAlternatives || decisionControl.showAlternatives,

    },

  };

}



function clampWeight(value: number): number {

  return Math.max(0, Math.min(2, value));

}


