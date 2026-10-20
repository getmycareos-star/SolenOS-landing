/**
 * WHY explanation for a chosen action — NOT a Timeline WHAT event.
 */
export type DecisionHistory = {
  situationId: string;
  decisionId: string;
  chosenAction: string;
  rejectedAlternatives: string[];
  reasoningSummary: string;
  assumptionsUsed: string[];
  missingInfoImpact: string[];
  timestamp: string;
};

export type DecisionHistoryLog = {
  readonly entries: readonly DecisionHistory[];
};

export type WriteDecisionHistoryParams = {
  situationId: string;
  chosenAction: string;
  rejectedAlternatives?: string[];
  reasoningSummary: string;
  assumptionsUsed?: string[];
  missingInfoImpact?: string[];
  decisionId?: string;
  timestamp?: string;
};
