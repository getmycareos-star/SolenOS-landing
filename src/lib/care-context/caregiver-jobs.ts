import type { CaregiverJob } from "./types";

export interface CaregiverJobDefinition {
  job: CaregiverJob;
  label: string;
  caregiverQuestions: string[];
  productOutcome: string;
  enginesInvolved: string[];
}

/** The five real jobs caregivers hire SolenOS to perform. */
export const CAREGIVER_JOBS: CaregiverJobDefinition[] = [
  {
    job: "reduce_decision_fatigue",
    label: "Reduce Decision Fatigue",
    caregiverQuestions: [
      "What should I do?",
      "Is this enough?",
      "Is it time?",
      "Should I hire help?",
    ],
    productOutcome:
      "Reduce the number of difficult decisions caregivers make without adequate context.",
    enginesInvolved: [
      "reason-through-context",
      "clarification-engine",
      "trust-layer",
    ],
  },
  {
    job: "reduce_cognitive_load",
    label: "Reduce Cognitive Load",
    caregiverQuestions: [
      "I can't remember what happened.",
      "What did the doctor say last time?",
      "Am I forgetting something?",
    ],
    productOutcome:
      "Continuously reconstruct reality so caregivers no longer need to remember everything.",
    enginesInvolved: ["timeline-engine", "care-snapshot-export"],
  },
  {
    job: "make_progression_visible",
    label: "Make Progression Visible",
    caregiverQuestions: [
      "Is this getting worse?",
      "Is this normal?",
      "What changed?",
    ],
    productOutcome:
      "Make improving, stable, and deteriorating trajectories visible over time.",
    enginesInvolved: [
      "diff-engine",
      "state-of-care-engine",
      "timeline-engine",
      "pattern-learning-engine",
    ],
  },
  {
    job: "increase_decision_confidence",
    label: "Increase Decision Confidence",
    caregiverQuestions: [
      "Should I worry?",
      "Am I doing enough?",
      "How much help do I actually need?",
    ],
    productOutcome:
      "Communicate what is known, uncertain, and why confidence changed — appropriate confidence, not false certainty.",
    enginesInvolved: ["trust-layer", "clarification-engine"],
  },
  {
    job: "prepare_for_conversations",
    label: "Prepare for Important Conversations",
    caregiverQuestions: [
      "What should I tell the doctor?",
      "How do I explain this to my family?",
    ],
    productOutcome:
      "Organize observations into structured chronological summaries without replacing clinical expertise.",
    enginesInvolved: ["timeline-engine", "care-snapshot-export"],
  },
];

export function jobForQuestion(question: string): CaregiverJob[] {
  const lower = question.toLowerCase();
  const matched: CaregiverJob[] = [];

  for (const def of CAREGIVER_JOBS) {
    if (
      def.caregiverQuestions.some((q) =>
        lower.includes(q.toLowerCase().replace(/\?/g, "")),
      ) ||
      (def.job === "reduce_decision_fatigue" &&
        /\b(should i|is it time|what should i do|hire help|enough)\b/i.test(
          lower,
        )) ||
      (def.job === "make_progression_visible" &&
        /\b(getting worse|what changed|is this normal)\b/i.test(lower)) ||
      (def.job === "reduce_cognitive_load" &&
        /\b(can't remember|forgetting|mixed up)\b/i.test(lower))
    ) {
      matched.push(def.job);
    }
  }

  return matched.length > 0 ? matched : ["reduce_decision_fatigue"];
}
