import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { Assumption, AssumptionInvalidationEvent, AssumptionRegistryState } from "./types";
import { invalidateAssumption } from "./store";

export type ContradictionPair = {
  assumptionPattern: RegExp;
  evidencePattern: RegExp;
  reason: string;
  trigger: AssumptionInvalidationEvent["trigger"];
};

/** Known contradictory evidence pairs — document/user vs existing assumptions. */
export const CONTRADICTION_PAIRS: readonly ContradictionPair[] = [
  {
    assumptionPattern: /\bappeal (?:is )?(?:still )?(?:pending|unresolved|open|in progress)\b/i,
    evidencePattern: /\bappeal (?:was )?(?:approved|granted|accepted|resolved)\b/i,
    reason: "document/user confirms appeal approved vs assumption appeal unresolved",
    trigger: "document",
  },
  {
    assumptionPattern: /\bappeal (?:still )?(?:pending|unresolved)\b/i,
    evidencePattern: /\bappeal approved\b/i,
    reason: "appeal approved contradicts unresolved appeal assumption",
    trigger: "user_input",
  },
  {
    assumptionPattern: /\bmedication schedule (?:is )?(?:unchanged|the same|stable)\b/i,
    evidencePattern: /\b(?:doctor|physician|provider) (?:adjusted|changed|modified) (?:the )?(?:dosage|dose|medication)\b/i,
    reason: "doctor adjusted dosage vs assumption medication schedule unchanged",
    trigger: "user_input",
  },
  {
    assumptionPattern: /\bmedication schedule unchanged\b/i,
    evidencePattern: /\bdosage (?:was )?(?:adjusted|changed|modified)\b/i,
    reason: "dosage change contradicts unchanged medication schedule assumption",
    trigger: "user_input",
  },
  {
    assumptionPattern: /\b(?:insurance|coverage) (?:still )?(?:pending|unresolved|denied)\b/i,
    evidencePattern: /\b(?:insurance|coverage) (?:approved|confirmed|active)\b/i,
    reason: "coverage approved contradicts pending/denied assumption",
    trigger: "document",
  },
  {
    assumptionPattern: /\b(?:appointment|visit) (?:still )?(?:unscheduled|not booked|pending)\b/i,
    evidencePattern: /\b(?:appointment|visit) (?:is )?(?:scheduled|booked|confirmed)\b/i,
    reason: "appointment scheduled contradicts unscheduled assumption",
    trigger: "user_input",
  },
];

export type DetectedAssumptionSignal = {
  statement: string;
  confidence: number;
  source: Assumption["source"];
  relatedSituationId?: string;
};

const INPUT_ASSUMPTION_PATTERNS: readonly {
  pattern: RegExp;
  statement: string;
  confidence: number;
}[] = [
  {
    pattern: /\bappeal (?:is )?(?:still )?(?:pending|unresolved|open)\b/i,
    statement: "Appeal is still unresolved",
    confidence: 0.75,
  },
  {
    pattern: /\bmedication schedule (?:is )?(?:unchanged|the same|stable)\b/i,
    statement: "Medication schedule is unchanged",
    confidence: 0.8,
  },
  {
    pattern: /\b(?:insurance|coverage) (?:still )?(?:pending|unresolved)\b/i,
    statement: "Insurance/coverage issue still pending",
    confidence: 0.7,
  },
  {
    pattern: /\b(?:appointment|visit) (?:still )?(?:unscheduled|not booked)\b/i,
    statement: "Appointment still unscheduled",
    confidence: 0.72,
  },
  {
    pattern: /\b(?:assume|assuming|I think|probably|likely)\b/i,
    statement: "User-indicated provisional belief in input",
    confidence: 0.55,
  },
];

export function detectAssumptionSignalsFromInput(input: string): DetectedAssumptionSignal[] {
  const normalized = input.trim();
  if (!normalized) return [];

  const signals: DetectedAssumptionSignal[] = [];
  for (const { pattern, statement, confidence } of INPUT_ASSUMPTION_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({ statement, confidence, source: "user_input" });
    }
  }
  return signals;
}

function collectEvidenceTexts(input?: string, documentIntelligence?: DocumentIntelligenceLayerResult): string[] {
  const texts: string[] = [];
  if (input?.trim()) texts.push(input.trim());
  if (documentIntelligence && !documentIntelligence.skipped) {
    for (const node of documentIntelligence.nodes) {
      texts.push(node.extracted.rawText ?? "");
      texts.push(...node.inference.suggestedInterpretations);
      texts.push(...node.extracted.obligations);
    }
  }
  return texts;
}

/**
 * Automatically invalidate when contradictory evidence appears in input or documents.
 */
export function detectContradictoryInvalidations(
  state: AssumptionRegistryState,
  params: {
    input?: string;
    documentIntelligence?: DocumentIntelligenceLayerResult;
    nowMs?: number;
  },
): { state: AssumptionRegistryState; events: AssumptionInvalidationEvent[] } {
  const evidenceTexts = collectEvidenceTexts(params.input, params.documentIntelligence);
  if (evidenceTexts.length === 0) return { state, events: [] };

  const combinedEvidence = evidenceTexts.join("\n");
  const events: AssumptionInvalidationEvent[] = [];
  let next = state;

  for (const assumption of state.assumptions) {
    if (assumption.status !== "active" && assumption.status !== "validated") continue;

    for (const pair of CONTRADICTION_PAIRS) {
      if (!pair.assumptionPattern.test(assumption.statement)) continue;
      if (!pair.evidencePattern.test(combinedEvidence)) continue;

      const trigger =
        params.documentIntelligence && !params.documentIntelligence.skipped
          ? pair.trigger
          : "user_input";

      const result = invalidateAssumption(
        next,
        assumption.assumptionId,
        pair.reason,
        trigger,
        params.nowMs,
      );
      next = result.state;
      if (result.event) events.push(result.event);
      break;
    }
  }

  return { state: next, events };
}

export function detectDocumentAssumptionSignals(
  documentIntelligence?: DocumentIntelligenceLayerResult,
): DetectedAssumptionSignal[] {
  if (!documentIntelligence || documentIntelligence.skipped) return [];
  const signals: DetectedAssumptionSignal[] = [];

  for (const node of documentIntelligence.nodes) {
    if (node.confidence.overall < 0.5) continue;
    for (const obligation of node.extracted.obligations.slice(0, 2)) {
      if (obligation.length > 12) {
        signals.push({
          statement: `Document obligation pending: ${obligation.slice(0, 120)}`,
          confidence: node.confidence.overall,
          source: "document",
        });
      }
    }
  }
  return signals;
}
