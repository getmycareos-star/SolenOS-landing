import {
  CAPABILITY_PHASES,
  CHAOS_FIRST_INGESTION,
  FUTURE_CAPABILITY_BOUNDARIES,
  FUTURE_CAPABILITY_IDS,
  FUTURE_CAPABILITY_READINESS_GATE,
  FUTURE_CAPABILITY_REGISTRY,
  FUTURE_CAPABILITY_STATUS,
} from "./contract-constants";
import type { FutureCapabilityId } from "./contract-constants";

export function isFutureCapability(id: string): id is FutureCapabilityId {
  return (FUTURE_CAPABILITY_IDS as readonly string[]).includes(id);
}

/** Gate for build filter — reject MVP UI for future capabilities. */
export function assertFutureCapabilityNotMvp(featureDescription: string): {
  blocked: boolean;
  reason: string;
  matched?: FutureCapabilityId;
} {
  const lower = featureDescription.toLowerCase();
  const matchers: Array<{ id: FutureCapabilityId; patterns: RegExp[] }> = [
    {
      id: "help_me_communicate_this",
      patterns: [/help me communicate/i, /communication draft/i, /message to sibling/i],
    },
    {
      id: "care_communication_support",
      patterns: [/care communication support/i, /family communication assistant/i],
    },
    {
      id: "care_moment",
      patterns: [/care moment/i, /something is happening/i, /capture a care moment/i],
    },
    {
      id: "i_need_clarity",
      patterns: [/i need clarity/i, /confidence collapse/i],
    },
    {
      id: "care_understanding_confidence",
      patterns: [/care understanding confidence/i, /understanding score/i],
    },
  ];

  // MVP voice surfaces — blocked even though not in FUTURE_CAPABILITY_REGISTRY phase IDs.
  if (
    /\b(mic(rophone)?|voice input|speech recognition|voice conversation|text-to-speech|hear solenos|read aloud|whisper)\b/i.test(
      lower,
    )
  ) {
    return {
      blocked: true,
      reason:
        "Voice / TTS / STT UI is post-MVP (ADR-018). MVP inputs are text + documents only.",
    };
  }

  for (const { id, patterns } of matchers) {
    if (patterns.some((p) => p.test(lower))) {
      const reg = FUTURE_CAPABILITY_REGISTRY[id];
      if (reg.phase === "phase_3" || reg.phase === "phase_2") {
        return {
          blocked: true,
          reason: `${reg.label} is ${reg.status} (${reg.phase}). ${FUTURE_CAPABILITY_READINESS_GATE}`,
          matched: id,
        };
      }
    }
  }
  return { blocked: false, reason: "Not a registered future capability UI request." };
}

export {
  CAPABILITY_PHASES,
  CHAOS_FIRST_INGESTION,
  FUTURE_CAPABILITY_BOUNDARIES,
  FUTURE_CAPABILITY_IDS,
  FUTURE_CAPABILITY_READINESS_GATE,
  FUTURE_CAPABILITY_REGISTRY,
  FUTURE_CAPABILITY_STATUS,
};
export type { FutureCapabilityId } from "./contract-constants";

export {
  CARE_COMMUNICATION_SUPPORT_IDENTITY,
  CARE_COMMUNICATION_SUPPORT_PRINCIPLE,
  COMMUNICATION_BOUNDARIES,
  COMMUNICATION_DRAFT_TYPES,
  COMMUNICATION_GROUNDING_SOURCES,
  COMMUNICATION_OUTPUT_SECTIONS,
  COMMUNICATION_STRATEGIC_GOAL,
} from "./care-communication-support";
export type {
  CareCommunicationBrief,
  CommunicationOutputSection,
} from "./care-communication-support";

export {
  CARE_UNDERSTANDING_CONFIDENCE_IDENTITY,
  CARE_UNDERSTANDING_CONFIDENCE_PRINCIPLE,
  CARE_UNDERSTANDING_FEELINGS,
  FORBIDDEN_CONFIDENCE_PATTERNS,
  FORBIDDEN_CONFIDENCE_UI,
  UNDERSTANDING_AREA_REQUIREMENTS,
  projectCareUnderstandingConfidenceStub,
  scanForbiddenConfidenceScores,
} from "./care-understanding-confidence";
export type {
  CareUnderstandingArea,
  CareUnderstandingConfidenceView,
  ReliabilityLevel,
  UnderstandingClarityLevel,
} from "./care-understanding-confidence";

export {
  CARE_MOMENT_BOUNDARIES,
  CARE_MOMENT_ENTRY_LABELS,
  CARE_MOMENT_FLOW,
  CARE_MOMENT_IDENTITY,
  CARE_MOMENT_INPUT_METHODS,
  CARE_MOMENT_RESPONSE_FRAMEWORK,
  CARE_MOMENT_SUCCESS_METRIC,
  CARE_MOMENT_TO_MOMENT_OF_NEED_MAP,
} from "./care-moment";
export type { CareMomentBrief, CareMomentResponseSection } from "./care-moment";

export {
  COLLAPSE_MOMENT_GOALS,
  CONFIDENCE_COLLAPSE_BOUNDARIES,
  CONFIDENCE_COLLAPSE_MOMENT_TYPES,
  CONFIDENCE_COLLAPSE_NORTH_STAR,
  I_NEED_CLARITY_IDENTITY,
  I_NEED_CLARITY_RESPONSE_SECTIONS,
} from "./confidence-collapse-moments";
export type {
  ConfidenceCollapseMomentType,
  ConfidenceCollapseSupportBrief,
} from "./confidence-collapse-moments";

export {
  HUMAN_CONTEXT_BOUNDARIES,
  HUMAN_CONTEXT_IDENTITY,
  HUMAN_CONTEXT_LAYERS,
  HUMAN_CONTEXT_PRINCIPLE,
  HUMAN_CONTEXT_TO_PROFILE_SECTION,
  HUMAN_CONTEXT_WRONG_VS_RIGHT,
} from "./human-context";
export type { HumanContextInsight, HumanContextLayer } from "./human-context";
