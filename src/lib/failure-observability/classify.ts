import type { StressNormalizedOutput } from "../input-stress-normalizer";
import type { FailureStage, FailureType } from "./types";

export function detectInputOverload(structuredInput: StressNormalizedOutput): boolean {
  const tags = new Set(structuredInput.detected_tags);
  return (
    tags.has("LONG_UNSTRUCTURED_TEXT") &&
    (tags.has("CONTRADICTORY_STATEMENTS") || tags.has("MIXED_INPUT"))
  );
}

export function classifyParseFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "model",
    failure_type: "MODEL_STRUCTURE_FAILURE",
  };
}

export function classifyZodFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "zod",
    failure_type: "ZOD_VALIDATION_FAILURE",
  };
}

export function classifyQualityFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "PROMPT_FAILURE",
  };
}

export function classifyOverloadFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "prompt",
    failure_type: "OVERLOAD_FAILURE",
  };
}

export function classifyInferenceInconsistency(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "INFERENCE_INCONSISTENCY_FAILURE",
  };
}

export function classifyConsistencyFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "CONSISTENCY_FAILURE",
  };
}

export function classifyPromptRegressionFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "PROMPT_REGRESSION_FAILURE",
  };
}

export function classifyStructureDriftFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "STRUCTURE_DRIFT_DETECTED",
  };
}

/** @deprecated Use classifyStructureDriftFailure */
export const classifyOutputStabilityFailure = classifyStructureDriftFailure;

export function classifyPriorityDriftFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "PRIORITY_DRIFT_DETECTED",
  };
}

export function classifyInterpretationDriftFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "INTERPRETATION_DRIFT_DETECTED",
  };
}

export function classifyMedicalBoundaryFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "MEDICAL_BOUNDARY_FAILURE",
  };
}

export function classifyEpistemicSafetyFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "EPISTEMIC_SAFETY_FAILURE",
  };
}

export function classifyGroundingFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "GROUNDING_VALIDATION_FAILURE",
  };
}

export function classifyUnknownStateFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "UNKNOWN_STATE_FAILURE",
  };
}

export function classifyEmotionalStabilizationFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "EMOTIONAL_STABILIZATION_FAILURE",
  };
}

export function classifyDocumentIntakeFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "DOCUMENT_INTAKE_FAILURE",
  };
}

export function classifyCalibratedUncertaintyFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "CALIBRATED_UNCERTAINTY_FAILURE",
  };
}

export function classifyCognitiveClarityFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "COGNITIVE_CLARITY_FAILURE",
  };
}

export function classifyUrgencyEscalationFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "URGENCY_ESCALATION_FAILURE",
  };
}

export function classifySafetyOverrideFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "SAFETY_OVERRIDE_FAILURE",
  };
}

export function classifyNonConversationalFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "NON_CONVERSATIONAL_FAILURE",
  };
}

export function classifyNonAssistantOutputFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "NON_ASSISTANT_OUTPUT_FAILURE",
  };
}

export function classifyEpisodicReliefFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "EPISODIC_RELIEF_FAILURE",
  };
}

export function classifyChaosToClarityFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "CHAOS_TO_CLARITY_FAILURE",
  };
}

export function classifySemanticRoleIsolationFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "SEMANTIC_ROLE_ISOLATION_FAILURE",
  };
}

export function classifyOutputCompressionFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "OUTPUT_COMPRESSION_FAILURE",
  };
}

export function classifyPressureReductionFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "PRESSURE_REDUCTION_FAILURE",
  };
}

export function classifyCognitiveCompressionFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "postprocess",
    failure_type: "COGNITIVE_COMPRESSION_FAILURE",
  };
}

export function classifyClarityGateBlockFailure(): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  return {
    stage: "prompt",
    failure_type: "CLARITY_GATE_BLOCK",
  };
}

export function classifyDeterminismFailure(failure_type: Extract<
  FailureType,
  | "CONSISTENCY_FAILURE"
  | "PROMPT_REGRESSION_FAILURE"
  | "STRUCTURE_DRIFT_DETECTED"
  | "PRIORITY_DRIFT_DETECTED"
  | "INTERPRETATION_DRIFT_DETECTED"
>): {
  stage: FailureStage;
  failure_type: FailureType;
} {
  switch (failure_type) {
    case "CONSISTENCY_FAILURE":
      return classifyConsistencyFailure();
    case "PROMPT_REGRESSION_FAILURE":
      return classifyPromptRegressionFailure();
    case "STRUCTURE_DRIFT_DETECTED":
      return classifyStructureDriftFailure();
    case "PRIORITY_DRIFT_DETECTED":
      return classifyPriorityDriftFailure();
    case "INTERPRETATION_DRIFT_DETECTED":
      return classifyInterpretationDriftFailure();
  }
}
