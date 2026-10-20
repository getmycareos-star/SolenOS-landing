import { SCORE_WEIGHTS } from "./contract-constants";
import { detectHumanImpact } from "./human-impact-override";
import type { DimensionScores, Issue, ScoreDimension, ScoredIssue } from "./types";

/**
 * STEP 3 — Deterministic scoring (no AI override of formula).
 *
 * priorityScore = safety*3 + time*2 + cost*2 + reversibility*1 + relief*1
 *
 * Heuristic MVP assigns 0|1|2|3 per dimension from keyword signals.
 * Score assignment may later use LLM-assisted *inputs*, but this formula
 * and the eventual ranking sort MUST remain deterministic.
 */

function clampDim(n: number): ScoreDimension {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

function matchScore(hay: string, patterns: readonly RegExp[], strength: ScoreDimension): ScoreDimension {
  for (const re of patterns) {
    if (re.test(hay)) return strength;
  }
  return 0;
}

const SAFETY_HIGH = [
  /\b(sparks?|sparking|exposed wir(?:e|ing)|electrical|shock|fire|gas leak|smoke)\b/i,
  /\b(bleeding|choking|not breathing|fell|wander(?:ing|ed)|elopement|emergency|911)\b/i,
  /\b(unsafe|hazard|immediate (?:danger|harm)|active harm)\b/i,
];
const SAFETY_MED = [
  /\b(fall risk|confused|agitated|lost|missing|alone overnight)\b/i,
  /\b(medication (?:missed|error)|wrong dose)\b/i,
];

const TIME_HIGH = [
  /\b(right now|immediately|tonight|can't wait|for days|getting worse|urgent)\b/i,
  /\b(sparks?|bleeding|choking|severe pain|terrible pain)\b/i,
];
const TIME_MED = [
  /\b(this week|soon|upcoming|appointment|needs attention)\b/i,
  /\b(tooth|dental|pain)\b/i,
];

const COST_HIGH = [
  /\b(hospital|lawsuit|permanent|structural|rewir|insurance claim)\b/i,
  /\b(electrical|fire risk|major repair)\b/i,
];
const COST_MED = [
  /\b(dental|dentist|doctor|specialist|costly|expensive)\b/i,
];

const REVERSIBILITY_HIGH = [
  /\b(permanent|irreversible|can't undo|structural damage|fire)\b/i,
  /\b(electrical|wiring|shock)\b/i,
];
const REVERSIBILITY_MED = [
  /\b(infection|worsening|deteriorat|tooth|dental|pain for days)\b/i,
];

const RELIEF_HIGH = [
  /\b(pain|distress|can't sleep|terrified|panic|agitat)/i,
  /\b(sparks?|shock|unsafe)\b/i,
];
const RELIEF_MED = [
  /\b(stress|worried|anxious|uncomfortable|frustrated)\b/i,
];

/** Low-urgency household maintenance — deliberately weak scores. */
const LOW_URGENCY = [
  /\b(laundry|repaint|paint(?:ing)?|declutter|organize|tidy|chores?|gardening|shopping list)\b/i,
  /\b(hallway|walls?|cosmetic|nice to have|whenever)\b/i,
];

export function computePriorityScore(dimensions: DimensionScores): number {
  return (
    dimensions.safety * SCORE_WEIGHTS.safety +
    dimensions.time * SCORE_WEIGHTS.time +
    dimensions.cost * SCORE_WEIGHTS.cost +
    dimensions.reversibility * SCORE_WEIGHTS.reversibility +
    dimensions.relief * SCORE_WEIGHTS.relief
  );
}

/**
 * Heuristic dimension assignment — documented MVP inputs to the fixed formula.
 */
export function scoreDimensions(issue: Issue): {
  dimensions: DimensionScores;
  uncertain: boolean;
} {
  const hay = issue.title;
  const low = LOW_URGENCY.some((re) => re.test(issue.title));

  let safety = Math.max(
    matchScore(hay, SAFETY_HIGH, 3),
    matchScore(hay, SAFETY_MED, 2),
  );
  let time = Math.max(matchScore(hay, TIME_HIGH, 3), matchScore(hay, TIME_MED, 2));
  let cost = Math.max(matchScore(hay, COST_HIGH, 3), matchScore(hay, COST_MED, 2));
  let reversibility = Math.max(
    matchScore(hay, REVERSIBILITY_HIGH, 3),
    matchScore(hay, REVERSIBILITY_MED, 2),
  );
  let relief = Math.max(
    matchScore(hay, RELIEF_HIGH, 3),
    matchScore(hay, RELIEF_MED, 2),
  );

  if (low) {
    safety = clampDim(Math.min(safety, 1));
    time = clampDim(Math.min(time, 1));
    cost = clampDim(Math.min(cost, 1));
    reversibility = clampDim(Math.min(reversibility, 1));
    relief = clampDim(Math.min(relief, 1));
  }

  // Mild baseline so uncategorized issues are not all-zero ties.
  if (safety + time + cost + reversibility + relief === 0) {
    return {
      dimensions: {
        safety: 1,
        time: 1,
        cost: 1,
        reversibility: 1,
        relief: 1,
      },
      uncertain: true,
    };
  }

  return {
    dimensions: {
      safety: clampDim(safety),
      time: clampDim(time),
      cost: clampDim(cost),
      reversibility: clampDim(reversibility),
      relief: clampDim(relief),
    },
    uncertain: false,
  };
}

export function scoreIssue(issue: Issue): ScoredIssue {
  const { dimensions, uncertain } = scoreDimensions(issue);
  return {
    ...issue,
    dimensions,
    priorityScore: computePriorityScore(dimensions),
    prioritySignal: detectHumanImpact(issue),
    uncertain,
  };
}

export function scoreIssues(issues: readonly Issue[]): ScoredIssue[] {
  return issues.map(scoreIssue);
}
