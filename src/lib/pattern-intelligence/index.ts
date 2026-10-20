export {
  PATTERN_INTELLIGENCE_IDENTITY,
  PATTERN_INTELLIGENCE_BOUNDARY,
  PROHIBITED_PATTERN_LANGUAGE,
  DISCUSSION_FRAMING,
  PATTERN_TYPES,
  PROACTIVE_OUTPUT_TYPES,
  PATTERN_CONFIDENCE_LEVELS,
  FREQUENCY_WINDOW_DAYS,
  CO_OCCURRENCE_WINDOW_DAYS,
  INACTIVITY_THRESHOLD_DAYS,
} from "./contract-constants";

export type {
  PatternType,
  ProactiveOutputType,
  PatternConfidence,
  DetectedPattern,
  ProactiveSignal,
  PatternIntelligenceResult,
  PatternIntelligenceLayerPayload,
} from "./types";

export { detectFrequencyPatterns } from "./frequency-patterns";
export { detectTrendPatterns } from "./trend-patterns";
export { detectCoOccurrencePatterns } from "./co-occurrence-patterns";
export { detectEscalationPatterns } from "./escalation-patterns";

export { runPatternEngine, patternEngineEventCount } from "./pattern-engine";

export {
  detectInactivitySignal,
  detectFollowUpSignals,
  detectEventBasedSignals,
  detectAppointmentNearSignals,
  detectRiskPatternAlert,
} from "./proactive-triggers";

export {
  buildPatternSummary,
  formatPatternExplanation,
  formatRiskPatternAlert,
  sanitizePatternText,
  lowConfidenceNote,
} from "./pattern-explanation";

export {
  runProactiveEngine,
  runPatternIntelligence,
  getLastPatternIntelligenceResult,
  getPatternExplanation,
  resetPatternIntelligenceStore,
} from "./proactive-engine";

export { toPatternIntelligenceLayerPayload } from "./layer-payload";
