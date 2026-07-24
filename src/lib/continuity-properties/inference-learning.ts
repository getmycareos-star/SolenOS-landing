/**

 * Feedback-Driven Learning Loop (FDLL) — properties of inferences in the same runtime.

 * Only explicit caregiver feedback modifies learning weights (no silent drift).

 */



export type InferenceVerdict = "correct" | "incorrect" | "partially_correct";



export type StoredInference = {

  inference_id: string;

  care_event_ids: string[];

  output_summary: string;

  confidence_score: number;

  engine_source: string;

  created_at: string;

};



export type InferenceFeedback = {

  inference_id: string;

  verdict: InferenceVerdict;

  note?: string;

  submitted_at: string;

  /** Weight reliability of the feedback source (SRL). */

  feedback_source_reliability: number;

};



export type LearningWeightUpdate = {

  inference_id: string;

  confidence_delta: number;

  pattern_strength_delta: number;

  pathway_unreliable: boolean;

  components?: {

    timing?: number;

    event_detection?: number;

    progression?: number;

  };

  reason: string;

};



const inferenceStore = new Map<string, StoredInference>();

const feedbackStore: InferenceFeedback[] = [];

const weightHistory: LearningWeightUpdate[] = [];



export function recordInference(inference: StoredInference): StoredInference {

  inferenceStore.set(inference.inference_id, inference);

  return inference;

}



export function getInference(id: string): StoredInference | undefined {

  return inferenceStore.get(id);

}



/**

 * Explicit feedback only — required architectural rule.

 */

export function applyInferenceFeedback(feedback: InferenceFeedback): LearningWeightUpdate {

  feedbackStore.push(feedback);

  const inference = inferenceStore.get(feedback.inference_id);

  const reliability = Math.max(0.2, Math.min(1, feedback.feedback_source_reliability));



  let update: LearningWeightUpdate;

  if (feedback.verdict === "correct") {

    update = {

      inference_id: feedback.inference_id,

      confidence_delta: 0.08 * reliability,

      pattern_strength_delta: 0.1 * reliability,

      pathway_unreliable: false,

      reason: `Correct feedback strengthens ${inference?.engine_source ?? "unknown"} pathway`,

    };

  } else if (feedback.verdict === "incorrect") {

    update = {

      inference_id: feedback.inference_id,

      confidence_delta: -0.2 * reliability,

      pattern_strength_delta: -0.15 * reliability,

      pathway_unreliable: true,

      reason: `Incorrect feedback marks ${inference?.engine_source ?? "unknown"} pathway unreliable`,

    };

  } else {

    update = {

      inference_id: feedback.inference_id,

      confidence_delta: -0.05 * reliability,

      pattern_strength_delta: 0,

      pathway_unreliable: false,

      components: {

        timing: 0,

        event_detection: 0.05 * reliability,

        progression: -0.05 * reliability,

      },

      reason: "Partial feedback refines granularity — not binary learning",

    };

  }



  weightHistory.push(update);

  return update;

}



export function listPendingInferences(): StoredInference[] {

  const feedbackIds = new Set(feedbackStore.map((f) => f.inference_id));

  return [...inferenceStore.values()].filter((i) => !feedbackIds.has(i.inference_id));

}



export function resetInferenceLearningStore(): void {

  inferenceStore.clear();

  feedbackStore.length = 0;

  weightHistory.length = 0;

}



export function getLearningHistory(): LearningWeightUpdate[] {

  return [...weightHistory];

}


