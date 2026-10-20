import type { SolenOSResponse } from "../output-contract";
import type { DetectedLoadSignalFamilies, LoadScores } from "../caregiver-load-engine/types";
import type { AttentionClassification } from "./types";

const EDUCATION_SUPPRESS_PATTERNS = [
  /\bdementia\b/i,
  /\balzheimer/i,
  /\bcare (?:technique|tip|strategy|plan)\b/i,
  /\bmedication education\b/i,
  /\bunderstanding (?:dementia|alzheimer|the disease)\b/i,
  /^(?:\d+\s+)?tips?\b/i,
  /\btreatment (?:option|plan)\b/i,
];

function looksLikeEducation(text: string): boolean {
  return EDUCATION_SUPPRESS_PATTERNS.some((p) => p.test(text.trim()));
}

function loadFraming(
  classification: AttentionClassification,
  scores: LoadScores,
  signals: DetectedLoadSignalFamilies,
): string | null {
  void scores;
  const dominant = classification.dominantLoadCategory;
  if (dominant === "repetition" || signals.repetition >= 0.35) {
    return "Repetition is showing up in what you shared. What you shared is held — one care detail is enough for now.";
  }
  if (dominant === "sleep" || signals.sleep >= 0.35) {
    return "Sleep disruption is showing up in what you shared. When ready, share one care detail that would help the picture.";
  }
  if (dominant === "emotional" || signals.emotionalDistress >= 0.35) {
    return "What you shared is held in the Living Care Record. When ready, share what is happening in care.";
  }
  if (dominant === "uncertainty" || scores.uncertaintyIndex >= 0.35) {
    return "Uncertainty is part of what was shared. Capturing one care detail can help orientation.";
  }
  if (dominant === "dependency" || scores.dependencyLoadScore >= 45) {
    return "Growing care needs are reflected in what was shared. One manageable care detail is enough for now.";
  }
  return null;
}

function calmAttentionLead(classification: AttentionClassification): string {
  return `${classification.label} ${classification.reasoning}`;
}

export type ShapeBehavioralResponseParams = {
  response: SolenOSResponse;
  classification: AttentionClassification;
  scores: LoadScores;
  signals: DetectedLoadSignalFamilies;
  suppressEducation?: boolean;
  loadSignalsPresent?: boolean;
};

/**
 * Behavioral Spec v1 output shaping — load-aware, calm, non-educational when load present.
 */
export function shapeBehavioralResponse(params: ShapeBehavioralResponseParams): SolenOSResponse {
  const {
    response,
    classification,
    scores,
    signals,
    suppressEducation = false,
    loadSignalsPresent = false,
  } = params;

  const framing = loadFraming(classification, scores, signals);
  const attentionLead = calmAttentionLead(classification);

  let whatIsHappening = response.what_is_happening;
  if (framing && (suppressEducation || loadSignalsPresent)) {
    whatIsHappening = framing;
  } else if (framing && looksLikeEducation(whatIsHappening)) {
    whatIsHappening = framing;
  }

  const whatMattersNow = [
    attentionLead,
    framing && !whatIsHappening.includes(framing) ? framing : null,
    suppressEducation && looksLikeEducation(response.what_matters_now)
      ? "Focus on one manageable step — not care technique research."
      : response.what_matters_now,
  ]
    .filter(Boolean)
    .join(" ");

  let whatToAskNext = response.what_to_ask_next;
  if (suppressEducation && looksLikeEducation(whatToAskNext)) {
    whatToAskNext =
      "Pause and name what is weighing on you most — one question about safety only if needed.";
  }

  return {
    ...response,
    what_is_happening: whatIsHappening,
    what_matters_now: whatMattersNow,
    what_to_ask_next: whatToAskNext,
  };
}
