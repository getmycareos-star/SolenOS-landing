import type {
  PATTERN_CONFIDENCE_LEVELS,
  PATTERN_TYPES,
  PROACTIVE_OUTPUT_TYPES,
} from "./contract-constants";

export type PatternType = (typeof PATTERN_TYPES)[number];
export type ProactiveOutputType = (typeof PROACTIVE_OUTPUT_TYPES)[number];
export type PatternConfidence = (typeof PATTERN_CONFIDENCE_LEVELS)[number];

export type DetectedPattern = {
  id: string;
  pattern_type: PatternType;
  label: string;
  description: string;
  event_ids: string[];
  confidence: PatternConfidence;
  window_days: number;
  discussion_note: string;
};

export type ProactiveSignal = {
  id: string;
  output_type: ProactiveOutputType;
  title: string;
  message: string;
  confidence: PatternConfidence;
  related_event_ids: string[];
  triggered_at: string;
};

export type PatternIntelligenceResult = {
  patterns: DetectedPattern[];
  proactive_signals: ProactiveSignal[];
  pattern_summary: string[];
  analyzed_at: string;
  events_analyzed: number;
  low_confidence_note: string | null;
};

export type PatternIntelligenceLayerPayload = {
  identity: string;
  boundary: string;
  result: PatternIntelligenceResult;
};
