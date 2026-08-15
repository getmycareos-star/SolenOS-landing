/**
 * Input Relevance Classification — determines whether submitted input is
 * relevant care evidence, uncertain, irrelevant, or unreadable.
 *
 * This is the FIRST gate after ingestion policy. It runs before DARE
 * to prevent irrelevant material from entering the Care Reality pipeline.
 */

import { isGibberish } from "../ambiguity-structure-validation/dimensions";
import type { InputMode } from "../input-classification";

const CARE_RELEVANCE_SIGNALS = [
  /\b(?:fell|fall|fallen|tripped|injur\w*|pain|fever|symptom|confus\w*|agitat\w*)\b/i,
  /\b(?:wander\w*|refus\w*|eat\w*|appetite|meal|sleep|mobility|walker|wheelchair|hospital|er\b|911)\b/i,
  /\b(?:medication|med|pill|dose|prescription|insulin|discharge)\b/i,
  /\b(?:appointment|follow[- ]?up|doctor|nurse|cardiolog\w*|therap\w*)\b/i,
  /\b(?:mom|dad|mother|father|patient|care recipient|husband|wife|grandma|grandpa)\b/i,
  /\b(?:worse|better|improv\w*|declin\w*|stable|unchanged)\b/i,
  /\b(?:book|schedule|need to|remind|task|call\b)/i,
  /\b(?:insurance|claim|billing|coordination)\b/i,
  /\b(?:yesterday|today|last night|this morning|this week|\d{1,2}[/-]\d{1,2})\b/i,
  /\b(?:behavior|agitated|sundown\w*|hallucin\w*|deliri\w*)\b/i,
] as const;

const SUBJECT_DEFINITION_PATTERNS = [
  /\b(?:mom|mother|dad|father|parent|husband|wife|spouse|partner)\b/i,
  /\b(?:grandma|grandmother|grandpa|grandfather|grandparent)\b/i,
  /\b(?:patient|care recipient|loved one|relative)\b/i,
  /\b(?:my|our)\s+\w+/i,
  /\b(?:she|he|they)\b/i,
] as const;

const STAKEHOLDER_CONTEXT_PATTERNS = [
  /\b(?:doctor|physician|nurse|caregiver|aide|therapist|specialist)\b/i,
  /\b(?:hospital|clinic|facility|nursing home|hospice|pharmacy)\b/i,
  /\b(?:family|sibling|brother|sister|daughter|son)\b/i,
  /\b(?:insurance|payer|social worker|case manager)\b/i,
] as const;

function hasCareSignals(text: string): boolean {
  return CARE_RELEVANCE_SIGNALS.some((pattern) => pattern.test(text));
}

function hasSubjectDefinition(text: string): boolean {
  return SUBJECT_DEFINITION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasStakeholderContext(text: string): boolean {
  return STAKEHOLDER_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export const INPUT_RELEVANCE_OUTCOMES = [
  "RELEVANT_CARE_EVIDENCE",
  "POSSIBLY_RELEVANT",
  "IRRELEVANT_INPUT",
  "UNREADABLE_INPUT",
  "GIBBERISH_INPUT",
] as const;

export type InputRelevanceOutcome = (typeof INPUT_RELEVANCE_OUTCOMES)[number];

export type InputRelevanceClassification = {
  outcome: InputRelevanceOutcome;
  confidence: "high" | "medium" | "low";
  reason: string;
  extracted_text?: string;
  suggested_action: "proceed" | "ask_clarification" | "reject" | "retry";
  user_message: string;
};

export function classifyInputRelevance(params: {
  text: string;
  inputMode?: InputMode;
  ocrConfidence?: number | null;
  extractedText?: string | null;
}): InputRelevanceClassification {
  const { text, inputMode, ocrConfidence, extractedText } = params;
  const content = (extractedText ?? text).trim();
  const sourceText = text.trim();

  // 1. Unreadable / insufficient input
  if (!content || content.length < 5) {
    return {
      outcome: "UNREADABLE_INPUT",
      confidence: "high",
      reason: "empty_or_too_short",
      extracted_text: content,
      suggested_action: "retry",
      user_message:
        "I couldn't read enough of this to determine what it contains. Try providing a clearer image or document, or describe the care information directly.",
    };
  }

  if (ocrConfidence !== undefined && ocrConfidence !== null && ocrConfidence < 0.4) {
    return {
      outcome: "UNREADABLE_INPUT",
      confidence: "high",
      reason: "low_ocr_confidence",
      extracted_text: content,
      suggested_action: "retry",
      user_message:
        "I couldn't read this clearly enough. Try taking another photo with the document closer, brighter, and fully visible.",
    };
  }

  // 2. Gibberish / non-meaningful text
  if (isGibberish(sourceText) && isGibberish(content)) {
    return {
      outcome: "GIBBERISH_INPUT",
      confidence: "high",
      reason: "gibberish_detected",
      extracted_text: content,
      suggested_action: "reject",
      user_message:
        "I couldn't identify meaningful care information in that text. Try describing an event, observation, medication, appointment, document, or other care-related information.",
    };
  }

  // 3. Relevance classification — care signals + subject/stakeholder context
  const careSignals = hasCareSignals(content);
  const hasSubject = hasSubjectDefinition(content);
  const hasStakeholder = hasStakeholderContext(content);
  const hasAnyCareContext = careSignals || hasSubject || hasStakeholder;

  // 3a. Irrelevant — no care signals, no subject, no stakeholder context
  if (!hasAnyCareContext) {
    return {
      outcome: "IRRELEVANT_INPUT",
      confidence: "medium",
      reason: "no_care_signals_detected",
      extracted_text: content,
      suggested_action: "reject",
      user_message:
        "This doesn't appear to contain information relevant to this person's care, so I haven't added it to the Care Record.",
    };
  }

  // 3b. Possibly relevant — care signals exist but unclear who/what
  if (careSignals && !hasSubject && !hasStakeholder) {
    return {
      outcome: "POSSIBLY_RELEVANT",
      confidence: "low",
      reason: "care_signals_without_clear_subject",
      extracted_text: content,
      suggested_action: "ask_clarification",
      user_message:
        "I found some information, but I'm not sure how it relates to this person's care. What would you like SolenOS to use this for?",
    };
  }

  // 3c. Relevant care evidence — care signals + subject/stakeholder context
  return {
    outcome: "RELEVANT_CARE_EVIDENCE",
    confidence: hasSubject || hasStakeholder ? "medium" : "low",
    reason: careSignals ? "care_evidence_with_subject" : "care_context_detected",
    extracted_text: content,
    suggested_action: "proceed",
    user_message: "",
  };
}
