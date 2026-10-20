import type { ClarificationGateResult } from "../ambiguity-structure-validation/types";
import { MISSING_DIMENSION_QUESTIONS } from "../ambiguity-structure-validation/contract-constants";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { MemoryInfluenceState } from "../memory-influence/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import { classifyMissingInformationImportance } from "./importance";
import type {
  MissingInformationImportance,
  MissingInformationSource,
} from "./types";

export type DetectedMissingInformationSignal = {
  question: string;
  importance: MissingInformationImportance;
  source: MissingInformationSource;
  situationId?: string;
};

/**
 * Reasoning Engine signals — e.g. cannot determine urgency because discharge date unknown.
 */
export function detectMissingFromReasoning(params: {
  careContext?: SituationalCareContext;
  timeEngine?: TimeEngineLayerResult;
  clarityGate?: ClarificationGateResult;
}): DetectedMissingInformationSignal[] {
  const signals: DetectedMissingInformationSignal[] = [];
  const ctx = params.careContext;

  if (params.timeEngine?.signals.missingTime) {
    signals.push({
      question: "What is the relevant date or timeframe for this situation?",
      importance: "HIGH",
      source: "reasoning",
    });
  }

  if (ctx?.urgencyLevel === "CRITICAL" || ctx?.situationType === "uncertain_state") {
    const hasDischargeMention = ctx.unresolvedItems.some((i) =>
      /discharg/i.test(i),
    );
    if (hasDischargeMention || /discharg/i.test(ctx.recentEvents.join(" "))) {
      signals.push({
        question: "What is the discharge date?",
        importance: "HIGH",
        source: "reasoning",
      });
    }
  }

  for (const item of ctx?.unresolvedItems ?? []) {
    if (/unknown|unclear|missing|not sure|unconfirmed/i.test(item)) {
      const question = item.includes("?")
        ? item
        : `What is still unknown about: ${item.replace(/\?$/, "")}?`;
      signals.push({
        question,
        importance: classifyMissingInformationImportance(question),
        source: "reasoning",
      });
    }
  }

  const missingDims = params.clarityGate?.clarity.missingDimensions ?? [];
  for (const dim of missingDims) {
    const question = MISSING_DIMENSION_QUESTIONS[dim];
    signals.push({
      question,
      importance: dim === "TIMEFRAME" || dim === "SUBJECT_DEFINITION" ? "HIGH" : "MEDIUM",
      source: "reasoning",
    });
  }

  return signals;
}

/**
 * Document Analysis — policy number referenced but absent, etc.
 */
export function detectMissingFromDocuments(
  documentIntelligence?: DocumentIntelligenceLayerResult,
): DetectedMissingInformationSignal[] {
  if (!documentIntelligence || documentIntelligence.skipped) return [];

  const signals: DetectedMissingInformationSignal[] = [];
  const textParts: string[] = [];

  for (const node of documentIntelligence.nodes) {
    textParts.push(node.extracted.rawText ?? "");
    textParts.push(...node.inference.ambiguityFlags);
    textParts.push(...node.inference.suggestedInterpretations);

    const fields = node.extracted.extractedFields;
    const fieldKeys = Object.keys(fields);

    if (/\bpolicy\s*(?:#|number|no\.?)\b/i.test(node.extracted.rawText) &&
      !fieldKeys.some((k) => /policy/i.test(k)) &&
      !/\bpolicy\s*(?:#|number|no\.?)[:\s]+\w+/i.test(node.extracted.rawText)) {
      signals.push({
        question: "What is the insurance policy number?",
        importance: "MEDIUM",
        source: "document",
      });
    }

    if (/\bdischarg/i.test(node.extracted.rawText) &&
      node.extracted.timestamps.length === 0) {
      signals.push({
        question: "What is the discharge date?",
        importance: "HIGH",
        source: "document",
      });
    }

    if (/\bdosage\b|\bdose\b/i.test(node.extracted.rawText) &&
      !fieldKeys.some((k) => /dose|dosage|medication/i.test(k))) {
      signals.push({
        question: "What is the medication dosage?",
        importance: "HIGH",
        source: "document",
      });
    }

    for (const flag of node.inference.ambiguityFlags) {
      signals.push({
        question: `What is still ambiguous in the document: ${flag.replace(/_/g, " ")}?`,
        importance: classifyMissingInformationImportance(flag),
        source: "document",
      });
    }
  }

  const combined = textParts.join("\n");
  if (/\bclaim\s*(?:#|number)\b/i.test(combined) && !/\bclaim\s*(?:#|number)[:\s]+\w+/i.test(combined)) {
    signals.push({
      question: "What is the claim number?",
      importance: "MEDIUM",
      source: "document",
    });
  }

  return signals;
}

/**
 * Memory Validation — primary caregiver inferred but never confirmed.
 */
export function detectMissingFromMemory(
  memoryState?: MemoryInfluenceState,
  careContext?: SituationalCareContext,
): DetectedMissingInformationSignal[] {
  if (!memoryState) return [];
  const signals: DetectedMissingInformationSignal[] = [];

  const identity = memoryState.memory.identityMemory.entries;
  const caregiverInferred = identity.some(
    (e) =>
      /primary\s+caregiver|caregiver\s+role/i.test(e.key) ||
      /primary\s+caregiver|caregiver\s+role/i.test(e.influenceLabel),
  );
  const caregiverConfirmed = identity.some(
    (e) =>
      e.tags.incorrect !== true &&
      e.confidence >= 0.85 &&
      (/primary\s+caregiver/i.test(e.key) || /primary\s+caregiver/i.test(e.influenceLabel)),
  );

  if (caregiverInferred && !caregiverConfirmed) {
    signals.push({
      question: "Who is the primary caregiver?",
      importance: "HIGH",
      source: "memory",
    });
  }

  const outdated = [
    ...memoryState.memory.identityMemory.entries,
    ...memoryState.memory.operationalMemory.entries,
  ].filter((e) => e.tags.outdated);

  for (const entry of outdated.slice(0, 3)) {
    signals.push({
      question: `Is this memory still accurate: ${entry.key}?`,
      importance: "MEDIUM",
      source: "memory",
    });
  }

  if (
    careContext?.userIntentSignal.confidence !== undefined &&
    careContext.userIntentSignal.confidence < 0.45 &&
    careContext.userIntentSignal.inferredIntent
  ) {
    signals.push({
      question: "What is the intended focus of this care situation?",
      importance: "MEDIUM",
      source: "memory",
    });
  }

  return signals;
}

/**
 * User Input — e.g. "Mom was discharged recently" with no date.
 */
export function detectMissingFromUserInput(input: string): DetectedMissingInformationSignal[] {
  const normalized = input.trim();
  if (!normalized) return [];

  const signals: DetectedMissingInformationSignal[] = [];

  if (
    /\bdischarg(?:ed|e)\b/i.test(normalized) &&
    !/\b(?:on|at)\s+\w+\s+\d{1,2}|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(
      normalized,
    )
  ) {
    signals.push({
      question: "What is the discharge date?",
      importance: "HIGH",
      source: "user_input",
    });
  }

  if (
    /\b(?:appeal|insurance)\b/i.test(normalized) &&
    /\b(?:pending|unknown|unsure|not sure)\b/i.test(normalized)
  ) {
    signals.push({
      question: "What is the insurance appeal status?",
      importance: "MEDIUM",
      source: "user_input",
    });
  }

  if (
    /\bdosage\b|\bdose\b|\bmedication\b/i.test(normalized) &&
    /\b(?:unsure|unknown|not sure|forgot|don't know|do not know)\b/i.test(normalized)
  ) {
    signals.push({
      question: "What is the medication dosage?",
      importance: "HIGH",
      source: "user_input",
    });
  }

  if (
    /\brecently\b|\ba while ago\b|\bnot sure when\b/i.test(normalized) &&
    !/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[\/\-]\d)/i.test(
      normalized,
    )
  ) {
    signals.push({
      question: "What is the exact date this happened?",
      importance: classifyMissingInformationImportance(
        "What is the exact date this happened?",
      ),
      source: "user_input",
    });
  }

  if (
    /\b(?:pharmacy|prefer)\b/i.test(normalized) &&
    /\b(?:prefer|preferred)\b/i.test(normalized) === false
  ) {
    // skip — no gap
  }

  return signals;
}
