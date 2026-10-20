import {
  StressNormalizedOutputSchema,
  type StressNormalizedOutput,
  type StressNormalizerTag,
} from "./types";

/** Structural whitespace normalization only — no semantic change. */
function structuralWhitespaceNormalize(input: string): string {
  return input
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

const EMOTIONAL_PATTERN =
  /\b(overwhelmed|terrified|scared|worried|anxious|exhausted|frustrated|stressed|crying|guilt|hopeless|panick(?:ed|ing)|can't cope|cannot cope|breaking down)\b/i;

const MEDICAL_PATTERN =
  /\b(medication|medicine|dose|hospital|discharge|oxygen|symptom|doctor|nurse|prescription|bp|blood pressure|heart rate|fever|pain|diagnosis|treatment|iv|wound|fall|unresponsive|responsive)\b/i;

const INCOMPLETE_PATTERN =
  /\b(not sure|don't know|dont know|unclear|unsure|maybe|might be|idk)\b|\?\?|\.\.\.|^\s*\?\s*$/i;

const POSITIVE_STATE_PATTERN = /\b(fine|okay|ok|good|well|stable|better|improving)\b/i;
const NEGATION_PATTERN =
  /\b(not|n't|never|no longer|unresponsive|nonresponsive|non-responsive|not responding|won't|cannot|can't)\b/i;

const LONG_TEXT_THRESHOLD = 480;
const LONG_WORD_THRESHOLD = 90;

function splitSentences(line: string): string[] {
  const parts = line.split(/(?<=[.!?])\s+/).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [line];
}

function buildSegments(raw_input: string): StressNormalizedOutput["segments"] {
  const segments: StressNormalizedOutput["segments"] = [];
  const lines = raw_input.split("\n");

  for (const line of lines) {
    if (line.length === 0) {
      segments.push({ type: "LINE_BREAK", content: "" });
      continue;
    }

    const sentences = splitSentences(line);
    if (sentences.length === 1) {
      segments.push({ type: "LINE", content: line });
      continue;
    }

    for (const sentence of sentences) {
      segments.push({ type: "SENTENCE", content: sentence });
    }
  }

  if (segments.length === 0 && raw_input.length > 0) {
    segments.push({ type: "LINE", content: raw_input });
  }

  return segments;
}

/** Reconstruct input from segments — must equal raw_input. */
export function reconstructFromSegments(
  segments: StressNormalizedOutput["segments"],
): string {
  const lines: string[] = [];
  let sentenceBuffer: string[] = [];

  const flushSentenceLine = () => {
    if (sentenceBuffer.length > 0) {
      lines.push(sentenceBuffer.join(" "));
      sentenceBuffer = [];
    }
  };

  for (const segment of segments) {
    if (segment.type === "LINE_BREAK") {
      flushSentenceLine();
      lines.push("");
      continue;
    }

    if (segment.type === "SENTENCE") {
      sentenceBuffer.push(segment.content);
      continue;
    }

    flushSentenceLine();
    lines.push(segment.content);
  }

  flushSentenceLine();
  return lines.join("\n");
}

function detectContradictions(segments: StressNormalizedOutput["segments"]): boolean {
  const positiveSegments = segments.filter((s) => POSITIVE_STATE_PATTERN.test(s.content));
  const negativeSegments = segments.filter((s) => NEGATION_PATTERN.test(s.content));
  return positiveSegments.length > 0 && negativeSegments.length > 0;
}

function detectTags(params: {
  raw_input: string;
  segments: StressNormalizedOutput["segments"];
  metadata: StressNormalizedOutput["metadata"];
}): StressNormalizerTag[] {
  const tags = new Set<StressNormalizerTag>();
  const wordCount = params.raw_input.split(/\s+/).filter(Boolean).length;

  if (
    params.raw_input.length >= LONG_TEXT_THRESHOLD ||
    wordCount >= LONG_WORD_THRESHOLD
  ) {
    tags.add("LONG_UNSTRUCTURED_TEXT");
  }

  if (params.metadata.has_emotional_language) {
    tags.add("EMOTIONAL_OVERLOAD");
  }

  if (params.metadata.has_medical_content) {
    tags.add("MEDICAL_FRAGMENT");
  }

  if (params.metadata.has_contradictions) {
    tags.add("CONTRADICTORY_STATEMENTS");
  }

  if (params.metadata.has_incomplete_context) {
    tags.add("INCOMPLETE_CONTEXT");
  }

  const segmentTypes = new Set(params.segments.map((s) => s.type));
  if (tags.size >= 2 || (segmentTypes.size > 1 && params.segments.length > 3)) {
    tags.add("MIXED_INPUT");
  }

  return [...tags].sort();
}

/**
 * Lossless structural preprocessor — format only, no semantic change.
 */
export function stressNormalizeInput(input: string): StressNormalizedOutput {
  const raw_input = structuralWhitespaceNormalize(input);
  const segments = buildSegments(raw_input);

  const metadata = {
    has_emotional_language: EMOTIONAL_PATTERN.test(raw_input),
    has_medical_content: MEDICAL_PATTERN.test(raw_input),
    has_contradictions: detectContradictions(segments),
    has_incomplete_context:
      INCOMPLETE_PATTERN.test(raw_input) ||
      segments.some((s) => INCOMPLETE_PATTERN.test(s.content)),
  };

  const detected_tags = detectTags({ raw_input, segments, metadata });

  const output: StressNormalizedOutput = {
    raw_input,
    detected_tags,
    segments,
    metadata,
  };

  return StressNormalizedOutputSchema.parse(output);
}

export function verifyLosslessStressOutput(output: StressNormalizedOutput): boolean {
  const reconstructed = reconstructFromSegments(output.segments);
  return reconstructed === output.raw_input;
}
