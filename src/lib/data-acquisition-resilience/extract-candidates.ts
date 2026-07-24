import {
  AUTO_VALIDATE_CONFIDENCE,
  OCR_CONFIDENCE_THRESHOLD,
} from "./contract-constants";
import type {
  AmbiguityFlag,
  CompletenessLevel,
  ConfidenceSource,
  DisambiguationQuestion,
  DocumentUnreadableSection,
  ExtractionCandidate,
  ExtractionMethod,
  RawInput,
  UncertainEventCandidate,
} from "./types";

const PRONOUN = /\b(he|she|they|him|her|them|it)\b/i;
const VAGUE = /\b(that|this|after that|wasn't doing well|not doing well)\b/i;
const FALL = /\b(fell|fall|fallen|tripped|slipped)\b/i;
const INSURANCE = /\b(insurance|claim|rejected|denied|payment)\b/i;
const CONFUSION = /\b(confus\w*|disorient\w*)\b/i;
const APPETITE =
  /\b(refus\w*\s+to\s+eat|refus\w*\s+(food|eating|meals?)|not eating|won't eat|wont eat|stopped eating|eating less|loss of appetite|appetite|no appetite)\b/i;
const DATE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s*\d{0,4}|yesterday|today|last week)\b/i;
const MONTH_DAY = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i;
const TIME_YESTERDAY = /\byesterday\b/i;
const TIME_TODAY = /\btoday\b/i;

function hasTimeReference(text: string): boolean {
  return (
    DATE.test(text) ||
    MONTH_DAY.test(text) ||
    TIME_YESTERDAY.test(text) ||
    TIME_TODAY.test(text)
  );
}

export function createCandidateId(): string {
  return `ec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createUncertainId(): string {
  return `uec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function estimateOcrConfidence(text: string, provided: number | null): number {
  if (provided !== null) return provided;
  if (!text.trim()) return 0;
  const garbled = (text.match(/[^a-zA-Z0-9\s.,!?;:'"-]/g) ?? []).length;
  const ratio = garbled / Math.max(text.length, 1);
  if (ratio > 0.15) return 0.35;
  if (text.split(/\s+/).length < 5) return 0.5;
  return 0.75;
}

function detectAmbiguity(text: string, inputType: RawInput["input_type"]): AmbiguityFlag[] {
  const flags: AmbiguityFlag[] = [];
  if (PRONOUN.test(text)) {
    if (/\bhe\b/i.test(text)) flags.push("who_is_he");
    if (/\bthey\b/i.test(text)) flags.push("who_is_they");
    flags.push("unclear_reference");
  }
  if (VAGUE.test(text)) {
    flags.push("what_changed");
    if (!hasTimeReference(text)) flags.push("when");
  }
  if (text.split(/\s+/).length < 4) flags.push("partial_signal");
  if (inputType === "voice_transcript" && /\[inaudible\]|\?\?|\.{3}/i.test(text)) {
    flags.push("voice_corruption");
  }
  return [...new Set(flags)];
}

function inferEventSignal(text: string): string {
  if (FALL.test(text)) return "possible_fall";
  if (INSURANCE.test(text)) return "financial_issue_signal";
  if (APPETITE.test(text)) return "appetite_change_signal";
  if (/\b(called|phone|spoke with|contacted)\b/i.test(text)) return "contact_event";
  if (CONFUSION.test(text)) return "health_deterioration_signal";
  if (VAGUE.test(text)) return "health_deterioration_signal";
  if (/\b(medication|prescription|dose)\b/i.test(text)) return "possible_medication_change";
  if (/\b(appointment|follow[- ]?up)\b/i.test(text)) return "follow_up_signal";
  return "observation_signal";
}

function inferMissingFields(text: string, signal: string): string[] {
  const missing: string[] = [];
  if (!hasTimeReference(text)) missing.push("time");
  if (signal === "possible_fall") {
    if (!/\b(injur\w*|hurt|hospital|er\b|pain)\b/i.test(text)) missing.push("severity");
    if (!/\b(after|because|result)\b/i.test(text)) missing.push("consequence");
  }
  if (PRONOUN.test(text)) missing.push("entity");
  if (VAGUE.test(text)) missing.push("what_changed");
  return [...new Set(missing)];
}

function inferCompleteness(missing: string[], text: string): CompletenessLevel {
  if (text.split(/\s+/).length < 3) return "insufficient";
  if (missing.length >= 2) return "partial";
  if (missing.length === 1) return "partial";
  return "complete";
}

function scoreConfidence(
  text: string,
  completeness: CompletenessLevel,
  ambiguityFlags: AmbiguityFlag[],
  ocrConfidence: number | null,
  method: ExtractionMethod,
): { score: number; sources: ConfidenceSource[] } {
  let score = 0.55;
  const sources: ConfidenceSource[] = ["nlp_model"];

  if (method === "ocr" || method === "document_parse") {
    sources.push("ocr");
    score = ocrConfidence ?? 0.5;
  }
  if (method === "voice_transcript") score -= 0.1;
  if (completeness === "complete") score += 0.15;
  else if (completeness === "partial") score -= 0.1;
  else score -= 0.3;

  if (/\b(yesterday|today|march|january|february|\d{1,2}[/-]\d{1,2})\b/i.test(text)) {
    score += 0.25;
  }

  score -= ambiguityFlags.length * 0.08;
  if (text.split(/\s+/).length > 12) score += 0.05;

  return {
    score: Math.max(0.05, Math.min(0.95, score)),
    sources: [...new Set(sources)],
  };
}

export function checkOcrFailure(
  rawInput: RawInput,
): DocumentUnreadableSection | null {
  if (rawInput.input_type !== "ocr_text" && rawInput.input_type !== "pdf" && rawInput.input_type !== "image") {
    return null;
  }

  const ocr = estimateOcrConfidence(rawInput.content, rawInput.ocr_confidence);
  if (!rawInput.content.trim()) {
    return {
      type: "document_unreadable_section",
      raw_input_id: rawInput.id,
      document_id: rawInput.document_id,
      reason: "empty_content",
      needs_user_review: true,
      ocr_confidence: ocr,
    };
  }

  if (ocr < OCR_CONFIDENCE_THRESHOLD) {
    return {
      type: "document_unreadable_section",
      raw_input_id: rawInput.id,
      document_id: rawInput.document_id,
      reason: "low_ocr_confidence",
      needs_user_review: true,
      ocr_confidence: ocr,
    };
  }

  return null;
}

function splitIntoSpans(content: string): string[] {
  const lines = content
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (lines.length === 0 && content.trim()) return [content.trim()];
  return lines.length > 0 ? lines : [];
}

export function extractCandidatesFromRawInput(rawInput: RawInput): ExtractionCandidate[] {
  const method: ExtractionMethod =
    rawInput.input_type === "voice_transcript"
      ? "voice_transcript"
      : rawInput.input_type === "text"
        ? "user_input"
        : rawInput.document_id
          ? "document_parse"
          : "ocr";

  const spans = splitIntoSpans(rawInput.content);
  const candidates: ExtractionCandidate[] = [];

  for (const span of spans.slice(0, 12)) {
    if (span.length < 2) continue;

    const ambiguity_flags = detectAmbiguity(span, rawInput.input_type);
    const event_signal = inferEventSignal(span);
    const missing_fields = inferMissingFields(span, event_signal);
    const completeness = inferCompleteness(missing_fields, span);
    const ocrConf = estimateOcrConfidence(span, rawInput.ocr_confidence);
    const { score, sources } = scoreConfidence(
      span,
      completeness,
      ambiguity_flags,
      ocrConf,
      method,
    );

    candidates.push({
      id: createCandidateId(),
      raw_input_id: rawInput.id,
      extracted_fact: span,
      event_signal,
      confidence: score,
      confidence_sources: sources,
      source_span: span,
      extraction_method: method,
      ambiguity_flags,
      completeness,
      missing_fields,
      created_at: new Date().toISOString(),
    });
  }

  return candidates;
}

export function buildUncertainEvents(
  candidates: ExtractionCandidate[],
  rawInputId: string,
): UncertainEventCandidate[] {
  const uncertain: UncertainEventCandidate[] = [];

  for (const c of candidates) {
    const weak =
      c.confidence < AUTO_VALIDATE_CONFIDENCE ||
      c.completeness !== "complete" ||
      c.ambiguity_flags.length > 0;

    if (!weak) continue;

    // Prefer caregiver words — never replace user text with internal signal names.
    let label = c.extracted_fact.trim().slice(0, 160);
    if (!label) label = c.event_signal.replace(/_/g, " ");
    if (c.event_signal === "possible_fall" && !FALL.test(label)) label = "possible fall";
    if (c.event_signal === "appetite_change_signal" && !APPETITE.test(label)) {
      label = "refusing to eat or appetite change";
    }
    if (c.event_signal === "health_deterioration_signal" && label.length < 12) {
      label = "health deterioration signal";
    }
    if (c.event_signal === "possible_medication_change" && label.length < 12) {
      label = "unclear medication change";
    }
    if (c.ambiguity_flags.includes("ocr_unreadable")) label = "OCR unreadable section";

    uncertain.push({
      id: createUncertainId(),
      raw_input_id: rawInputId,
      label,
      event_signal: c.event_signal,
      reason:
        c.completeness === "insufficient"
          ? "partial_extraction"
          : c.ambiguity_flags.length > 0
            ? "ambiguous_extraction"
            : "low_confidence",
      ambiguity: c.ambiguity_flags,
      missing_fields: c.missing_fields,
      needs_user_review: true,
      candidate_ids: [c.id],
      created_at: new Date().toISOString(),
    });
  }

  return uncertain;
}

export function generateDisambiguationQuestions(
  candidates: ExtractionCandidate[],
): DisambiguationQuestion[] {
  const questions: DisambiguationQuestion[] = [];

  for (const c of candidates) {
    if (c.ambiguity_flags.includes("who_is_he") || c.ambiguity_flags.includes("who_is_they")) {
      questions.push({
        question_id: `dq_${c.id}_who`,
        question_type: "disambiguation",
        priority: "high",
        question: "Who does this refer to?",
        related_candidate_ids: [c.id],
        ambiguity_flags: c.ambiguity_flags.filter((f) => f.startsWith("who_")),
      });
    }
    if (c.ambiguity_flags.includes("when") || c.missing_fields.includes("time")) {
      questions.push({
        question_id: `dq_${c.id}_when`,
        question_type: "disambiguation",
        priority: "high",
        question: "When did this happen?",
        related_candidate_ids: [c.id],
        ambiguity_flags: ["when"],
      });
    }
    if (c.ambiguity_flags.includes("what_changed")) {
      questions.push({
        question_id: `dq_${c.id}_what`,
        question_type: "disambiguation",
        priority: "high",
        question: "What specifically changed?",
        related_candidate_ids: [c.id],
        ambiguity_flags: ["what_changed"],
      });
    }
    if (c.event_signal === "possible_fall" && c.missing_fields.includes("consequence")) {
      questions.push({
        question_id: `dq_${c.id}_fall`,
        question_type: "disambiguation",
        priority: "medium",
        question: "Did the fall happen before or after any hospital visit?",
        related_candidate_ids: [c.id],
        ambiguity_flags: ["partial_signal"],
      });
    }
  }

  const seen = new Set<string>();
  return questions.filter((q) => {
    if (seen.has(q.question)) return false;
    seen.add(q.question);
    return true;
  }).slice(0, 5);
}

export function shouldAutoValidate(candidate: ExtractionCandidate): boolean {
  if (candidate.confidence < AUTO_VALIDATE_CONFIDENCE) return false;
  if (candidate.ambiguity_flags.length > 0) return false;
  if (candidate.completeness === "insufficient") return false;

  if (candidate.completeness === "partial") {
    const criticalMissing = candidate.missing_fields.filter((m) =>
      ["time", "entity", "what_changed"].includes(m),
    );
    if (criticalMissing.length > 0) return false;
  }

  return true;
}
