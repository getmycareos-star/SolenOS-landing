import type { SituationRelation, UnderstandingStage } from "../active-care-situation/types";
import type { ProgressiveUnderstandingEffect } from "./contract-constants";

export function classifyUnderstandingEffect(params: {
  relation: SituationRelation;
  resolvedCount: number;
  newSignalCount: number;
  introducedDimension: boolean;
  mattersChanged: boolean;
  stage: UnderstandingStage;
  priorStage: UnderstandingStage | null;
  invalidatesPrior?: boolean;
}): ProgressiveUnderstandingEffect {
  if (params.relation === "opens_new") return "opens_situation";
  if (params.resolvedCount > 0 || params.relation === "answers_uncertainty") {
    return "answers_uncertainty";
  }
  if (params.invalidatesPrior) return "invalidates_understanding";
  if (params.introducedDimension) return "introduces_new_dimension";
  if (params.mattersChanged) return "changes_what_matters";
  if (
    params.newSignalCount > 0 ||
    params.stage !== params.priorStage ||
    params.relation === "updates_active" ||
    params.relation === "adds_context"
  ) {
    return "strengthens_pattern";
  }
  return "continues_gathering";
}

/**
 * Quiet record language — not AI analysis voice.
 * Inspiration: solenosai.netlify.app — relief, not chatbot.
 */
export function buildProgressiveTurnCopy(params: {
  relation: SituationRelation;
  stage: UnderstandingStage;
  effect: ProgressiveUnderstandingEffect;
  observationCount: number;
  whatChanged: string | null;
  patternLabel: string | null;
}): {
  confirmation_title: string;
  confirmation_body: string;
  understanding_heading: string;
  insufficiency_note: string | null;
} {
  const { relation, stage, effect, observationCount } = params;

  if (relation === "opens_new" || observationCount <= 1) {
    return {
      confirmation_title: "Held in the Living Care Record",
      confirmation_body: "This is preserved in the Living Care Record.",
      understanding_heading: "What we know so far",
      insufficiency_note: null,
    };
  }

  let confirmation_title = "Care situation updated";
  let confirmation_body = "Connected to what was already held.";
  let understanding_heading = "What we know so far";
  let insufficiency_note: string | null = null;

  if (effect === "answers_uncertainty") {
    confirmation_body = "That helped — something unclear is now clearer.";
  } else if (effect === "invalidates_understanding") {
    confirmation_title = "Care situation updated";
    confirmation_body = "The latest update changed the current understanding.";
  } else if (effect === "introduces_new_dimension") {
    confirmation_body = "A new part of today's understanding was added.";
  } else if (stage === "synthesizing" || effect === "strengthens_pattern") {
    confirmation_body = "Updated today's care situation.";
  }

  if (stage === "forming" && effect !== "answers_uncertainty") {
    insufficiency_note = null;
  }

  return {
    confirmation_title,
    confirmation_body,
    understanding_heading,
    insufficiency_note,
  };
}

export function connectionNoteForProgress(params: {
  relation: SituationRelation;
  stage: UnderstandingStage;
  count: number;
  effect: ProgressiveUnderstandingEffect;
}): string | null {
  if (params.relation === "opens_new") {
    return null;
  }
  if (params.effect === "answers_uncertainty") {
    return null;
  }
  if (params.count === 2) {
    return "These may be parts of the same day — kept together.";
  }
  if (params.stage === "synthesizing" || params.count >= 3) {
    return "Related updates stay connected in the Living Care Record.";
  }
  return null;
}
