export {
  OBSERVATION_INTELLIGENCE_IDENTITY,
  OBSERVATION_INTELLIGENCE_PHILOSOPHY,
  OBSERVATION_INTELLIGENCE_SUCCESS_KPI,
  OBSERVATION_INTELLIGENCE_PIPELINE_POSITION,
  OBSERVATION_FORBIDDEN_OUTPUT,
  OBSERVATION_ANTI_PATTERNS,
  OBSERVATION_SEVERITY_LEVELS,
  OBSERVATION_SOURCES,
  OBSERVATION_RISK_LEVELS,
} from "./contract-constants";

export {
  OBSERVATION_CATEGORIES,
  OBSERVATION_SIGNALS,
  categoryForSignal,
  isValidSignalForCategory,
  allSignals,
  type ObservationCategory,
  type ObservationSignal,
  type ObservationSeverity,
  type StructuredObservation,
} from "./ontology";

export {
  assignSeverity,
  extractFrequency,
  detectSafetyRisk,
  detectUnsupervisedContext,
  detectIntensityWords,
  type SeverityContext,
} from "./assign-severity";

export {
  extractObservations,
  formatCategoryLabel,
  type ExtractionResult,
} from "./extract-observation";

export {
  saveObservation,
  getObservation,
  getStructuredForObservation,
  listObservationsForCaregiver,
  listStructuredForCaregiver,
  countObservationsThisWeek,
  persistObservations,
  resetObservationStore,
  observationStoreSchema,
  createObservationId,
  type ObservationRecord,
  type StructuredObservationRecord,
  type ObservationSource,
  type ObservationPersistenceAdapter,
} from "./stores/observation-store";

export {
  aggregateWeeklyFrequencies,
  detectTrendDirection,
  summarizeCategoryTrends,
  findIncreasingTrends,
  type TrendDirection,
  type SignalFrequencyPoint,
  type SignalTrend,
  type CategoryTrendSummary,
} from "./pattern-tracking";

export { generateWeeklySummary, type WeeklySummary } from "./weekly-summary";

export {
  buildSystemAggregation,
  containsForbiddenLanguage,
  assertNoForbiddenLanguage,
  sanitizeAggregationText,
  type SystemAggregation,
  type ObservationRiskLevel,
} from "./aggregate-output";

export {
  buildDoctorSummaryReport,
  exportReportAsHtml,
  exportReportAsText,
  exportReportAsPdfStub,
  type DoctorSummaryReport,
  type ExportReportFormat,
} from "./export-report";

import type { ObservationSource } from "./stores/observation-store";
import { extractObservations } from "./extract-observation";
import { buildSystemAggregation } from "./aggregate-output";
import {
  listObservationsForCaregiver,
  listStructuredForCaregiver,
  saveObservation,
  countObservationsThisWeek,
  persistObservations,
} from "./stores/observation-store";
import { generateWeeklySummary } from "./weekly-summary";
import { buildDoctorSummaryReport } from "./export-report";

export type RecordObservationInput = {
  caregiver_id: string;
  raw_text: string;
  source?: ObservationSource;
};

export type RecordObservationResult = {
  observation_id: string;
  structured: ReturnType<typeof extractObservations>["structured"];
  aggregation: ReturnType<typeof buildSystemAggregation>;
  weekly_summary_snippet: string;
  observations_this_week: number;
};

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/**
 * Record a caregiver observation — extraction + storage + aggregation.
 */
export function recordObservation(input: RecordObservationInput): RecordObservationResult {
  const caregiverId = input.caregiver_id || DEFAULT_CAREGIVER_ID;
  const source = input.source ?? "text";
  const extraction = extractObservations(input.raw_text);

  const { observation, structured } = saveObservation(
    caregiverId,
    input.raw_text,
    source,
    extraction.structured,
  );

  const history = listStructuredForCaregiver(caregiverId);
  const aggregation = buildSystemAggregation(extraction, history);
  const weekly = generateWeeklySummary(history);
  const observationsThisWeek = countObservationsThisWeek(caregiverId);

  void persistObservations(caregiverId);

  return {
    observation_id: observation.id,
    structured: extraction.structured,
    aggregation,
    weekly_summary_snippet: weekly.headline,
    observations_this_week: observationsThisWeek,
  };
}

export function getObservationWeeklySummary(caregiverId = DEFAULT_CAREGIVER_ID) {
  const history = listStructuredForCaregiver(caregiverId);
  return generateWeeklySummary(history);
}

export function getObservationExport(caregiverId = DEFAULT_CAREGIVER_ID) {
  const observations = listObservationsForCaregiver(caregiverId);
  const history = listStructuredForCaregiver(caregiverId);
  const weekly = generateWeeklySummary(history);

  const signalsByObservation = new Map<string, string[]>();
  for (const s of history) {
    const list = signalsByObservation.get(s.observation_id) ?? [];
    list.push(s.signal);
    signalsByObservation.set(s.observation_id, list);
  }

  const lastExtraction = observations.length
    ? extractObservations(observations[observations.length - 1]!.raw_text)
    : { structured: [], safetyRisk: false, supervisionRequired: false };

  const aggregation = buildSystemAggregation(lastExtraction, history);

  return buildDoctorSummaryReport({
    caregiverId,
    observations,
    weeklySummary: weekly,
    aggregation,
    signalsByObservation,
  });
}
