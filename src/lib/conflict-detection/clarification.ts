import { CONFLICT_CLARIFICATION_HEADLINE } from "./contract-constants";
import type {
  Conflict,
  ConflictClarification,
  ConflictRegistry,
  ConflictSeverity,
} from "./types";
import { listOpenConflicts } from "./registry";

const SEVERITY_RANK: Record<ConflictSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function buildClarificationForConflict(conflict: Conflict): {
  question: string;
  options?: readonly string[];
} {
  switch (conflict.type) {
    case "responsibility_conflict":
      return {
        question: "Who currently manages medications?",
        options: ["David", "Sarah", "Shared", "Someone else"],
      };
    case "medical_conflict":
      return {
        question: "What is the current status of this medication?",
        options: ["Active / still taking", "Discontinued / stopped", "Unsure"],
      };
    case "timeline_conflict":
      if (
        /refill|supply|picked up/i.test(
          `${conflict.statementA} ${conflict.statementB}`,
        )
      ) {
        return {
          question: "Has the medication already been refilled?",
          options: ["Yes, already refilled", "No, supply still ending", "Unsure"],
        };
      }
      return {
        question: "Which timeline is current — discharged or still hospitalized?",
        options: ["Discharged", "Still hospitalized", "Unsure"],
      };
    case "preference_conflict":
      return {
        question: "What is the current care preference for living arrangement?",
        options: ["Remain at home", "Assisted living / facility", "Undecided"],
      };
    case "fact_conflict":
    default:
      if (/live|living|alone/i.test(`${conflict.statementA} ${conflict.statementB}`)) {
        return {
          question: "What is the current living arrangement?",
          options: ["Lives alone", "Lives with family", "Other"],
        };
      }
      return {
        question: "Which statement is currently accurate?",
        options: [conflict.statementA, conflict.statementB, "Neither / unsure"],
      };
  }
}

/**
 * Surface ONE highest-severity open clarification.
 * Never emit aggregate counts like "17 conflicts detected."
 */
export function selectPrimaryClarification(
  registry: ConflictRegistry,
): ConflictClarification | null {
  const open = [...listOpenConflicts(registry)].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.confidence - a.confidence;
  });
  const top = open[0];
  if (!top) return null;
  if (top.severity === "LOW") return null; // LOW: no decision impact, skip UI nudge

  const built =
    top.clarificationQuestion != null
      ? {
          question: top.clarificationQuestion,
          options: top.clarificationOptions,
        }
      : buildClarificationForConflict(top);

  return {
    conflictId: top.id,
    type: top.type,
    severity: top.severity,
    question: built.question,
    options: built.options,
    headline: CONFLICT_CLARIFICATION_HEADLINE,
  };
}
