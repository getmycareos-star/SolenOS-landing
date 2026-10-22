import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import {
  buildPatternSummary,
  formatPatternExplanation,
  lowConfidenceNote,
} from "./pattern-explanation";
import { runPatternEngine } from "./pattern-engine";
import {
  detectAppointmentNearSignals,
  detectEventBasedSignals,
  detectFollowUpSignals,
  detectInactivitySignal,
  detectRiskPatternAlert,
} from "./proactive-triggers";
import type { PatternIntelligenceResult } from "./types";
import type { CaregivingMeeting } from "../meeting-preparation/types";

const lastResults = new Map<string, PatternIntelligenceResult>();

function cacheKey(caregiverId: string, caseId: string | null): string {
  return `${caregiverId}::${caseId ?? "default"}`;
}

/**
 * ProactiveEngine — runs without user prompting over structured Care Journey events.
 */
export function runProactiveEngine(
  caregiverId: string,
  caseId: string | null = null,
  now: Date = new Date(),
  meetings?: CaregivingMeeting[],
): PatternIntelligenceResult {
  const graph = getGraphForCaregiver(caregiverId, caseId);
  const events = graph?.events ?? [];
  const careHistoryStatus = !graph ? "unavailable" : events.length ? "available" : "no_recorded_events";

  const patterns = runPatternEngine(caregiverId, caseId, now);

  const proactive_signals = [
    detectInactivitySignal(events, now),
    ...detectFollowUpSignals(events, now),
    ...detectEventBasedSignals(events, now),
    ...(meetings ? detectAppointmentNearSignals(meetings, now) : []),
    detectRiskPatternAlert(patterns, now),
  ].filter((s): s is NonNullable<typeof s> => !!s);

  const pattern_summary = buildPatternSummary(patterns);
  const low_confidence_note = lowConfidenceNote(patterns);

  const result: PatternIntelligenceResult = {
    patterns,
    proactive_signals,
    pattern_summary,
    analyzed_at: now.toISOString(),
    events_analyzed: events.length,
    low_confidence_note,
    care_history_status: careHistoryStatus,
    appointment_signals_status: meetings ? "available" : "unavailable",
  };

  lastResults.set(cacheKey(caregiverId, caseId), result);
  return result;
}

export function getLastPatternIntelligenceResult(
  caregiverId: string,
  caseId: string | null = null,
): PatternIntelligenceResult | undefined {
  return lastResults.get(cacheKey(caregiverId, caseId));
}

export function getPatternExplanation(
  caregiverId: string,
  caseId: string | null = null,
): string {
  const result = getLastPatternIntelligenceResult(caregiverId, caseId);
  if (!result) return formatPatternExplanation([]);
  return formatPatternExplanation(result.patterns);
}

export function resetPatternIntelligenceStore(): void {
  lastResults.clear();
}

/** Full intelligence run — PatternEngine + ProactiveEngine. */
export function runPatternIntelligence(
  caregiverId: string,
  caseId: string | null = null,
  now: Date = new Date(),
  meetings?: CaregivingMeeting[],
): PatternIntelligenceResult {
  return runProactiveEngine(caregiverId, caseId, now, meetings);
}
