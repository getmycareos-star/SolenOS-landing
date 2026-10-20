import type {
  CaregiverFeedbackPrompt,
  CaregiverFeedbackResponse,
  FeedbackCalibrationResult,
  OMLState,
} from "./types";

export const FEEDBACK_PROMPTS: CaregiverFeedbackPrompt = {
  outputType: "state_of_care",
  questions: [
    "Was this helpful in understanding what's going on?",
    "Did this reduce confusion?",
    "Is anything missing or incorrect?",
  ],
};

export function createFeedbackPrompt(
  outputType: CaregiverFeedbackPrompt["outputType"],
): CaregiverFeedbackPrompt {
  return { ...FEEDBACK_PROMPTS, outputType };
}

/**
 * Process caregiver feedback — feeds confidence calibration,
 * pattern learning, failure detection, and metric adjustment.
 */
export function processCaregiverFeedback(
  omlState: OMLState,
  response: CaregiverFeedbackResponse,
): { updatedState: OMLState; calibration: FeedbackCalibrationResult } {
  const updatedState: OMLState = {
    ...omlState,
    feedback: [...omlState.feedback, response],
  };

  const calibration: FeedbackCalibrationResult = {
    confidenceAdjustment: 0,
    patternWeightAdjustment: 0,
    failureFlags: [],
    metricAdjustments: {},
  };

  if (response.helpfulness === "not_helpful") {
    calibration.confidenceAdjustment = -0.15;
    calibration.failureFlags.push(
      `Output type "${response.outputType}" marked not helpful — review engine output quality`,
    );
    calibration.metricAdjustments.time_to_understanding = 5;
  } else if (response.helpfulness === "partially") {
    calibration.confidenceAdjustment = -0.05;
  } else {
    calibration.confidenceAdjustment = 0.1;
    calibration.patternWeightAdjustment = 0.05;
  }

  if (response.reducedConfusion === "no") {
    calibration.failureFlags.push(
      "Feedback indicates confusion not reduced — continuity failure may persist",
    );
    calibration.metricAdjustments.cognitive_load_reduction = 10;
    calibration.metricAdjustments.caregiver_cognitive_load_score = 8;
  } else if (response.reducedConfusion === "somewhat") {
    calibration.metricAdjustments.clarification_load = 5;
  } else {
    calibration.metricAdjustments.cognitive_load_reduction = -5;
    calibration.metricAdjustments.time_to_understanding = -3;
  }

  if (response.missingOrIncorrect?.trim()) {
    calibration.failureFlags.push(
      `Caregiver reported gap: ${response.missingOrIncorrect.trim()}`,
    );
    calibration.metricAdjustments.timeline_reconstruction_accuracy = -10;

    updatedState.timelineCorrections = [
      ...updatedState.timelineCorrections,
      {
        eventId: "feedback",
        correctionType: "description_fix",
        notedAt: response.submittedAt,
      },
    ];
  }

  return { updatedState, calibration };
}

export function shouldPromptForFeedback(
  outputType: CaregiverFeedbackPrompt["outputType"],
  recentFeedback: CaregiverFeedbackResponse[],
): boolean {
  const recent = recentFeedback.filter((f) => f.outputType === outputType);
  return recent.length === 0;
}
