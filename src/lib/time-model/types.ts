/**
 * Time model beyond clocks — circadian, seasonal, life-stage, decision windows.
 *
 * The existing time-engine models scheduling and deadlines. This layer adds
 * the temporal understanding that actually shapes care decisions:
 * - Circadian patterns (when is the person alert vs confused?)
 * - Seasonal patterns (does condition worsen in winter?)
 * - Life-stage time (beginning, middle, or end of decline?)
 * - Decision windows (when is the right time to act?)
 */

export const TIME_MODEL_VERSION = "1.0.0";

/**
 * When something happened to the person, as opposed to when we heard about it.
 * Caregivability: an unknown time is a first-class value, never silently "now".
 */
export type EventTime = {
  type: "exact" | "range" | "relative" | "unknown";
  start?: string;
  end?: string;
  confidence: number;
};

export type ParseEventTimeResult = {
  event_time: EventTime;
  clarification_question?: string;
};

/**
 * The two orders a caregiver can be confused by: when things happened to the
 * person, and when we heard about them. Kept side by side so a late-arriving
 * correction never rewrites history silently.
 */
export type DualTimelineView = {
  temporal_order: string[];
  ingestion_order: string[];
};

export type RetimingReason = "retrospective_update" | "correction" | "reconciliation";

export type CareEventTimeCorrection = {
  id: string;
  original_event_id: string;
  previous_event_time: EventTime;
  updated_event_time: EventTime;
  reason: RetimingReason;
  corrected_at: string;
};

export type CircadianPattern = {
  id: string;
  timeOfDay: string;
  kind: "peak_alertness" | "trough_alertness" | "medication_window" | "meal_window" | "sleep_window" | "behavior_peak" | "behavior_trough";
  description: string;
  evidence: string;
  confidence: number;
  recordedAt: string;
};

export type SeasonalPattern = {
  id: string;
  season: "spring" | "summer" | "autumn" | "winter";
  kind: "worsening" | "improving" | "stable" | "behavior_increase" | "behavior_decrease" | "hospitalization_increase";
  description: string;
  evidence: string;
  confidence: number;
  recordedAt: string;
};

export type LifeStage = {
  stage: "early" | "middle" | "late" | "end_of_life";
  confidence: number;
  evidence: string;
  reasoning: string;
  recordedAt: string;
};

export type DecisionWindow = {
  id: string;
  decisionTopic: string;
  windowStart: string;
  windowEnd: string;
  urgency: "now" | "soon" | "this_week" | "this_month" | "can_wait";
  rationale: string;
  evidence: string[];
  consequencesOfWaiting: string;
  consequencesOfActingTooEarly: string;
  confidence: number;
  recordedAt: string;
};

export type TimeModel = {
  version: string;
  careRecipientId: string;
  circadianPatterns: CircadianPattern[];
  seasonalPatterns: SeasonalPattern[];
  lifeStage: LifeStage | null;
  decisionWindows: DecisionWindow[];
  createdAt: string;
  updatedAt: string;
};

export function createEmptyTimeModel(careRecipientId: string, createdAt?: string): TimeModel {
  const now = createdAt ?? new Date().toISOString();
  return {
    version: TIME_MODEL_VERSION,
    careRecipientId,
    circadianPatterns: [],
    seasonalPatterns: [],
    lifeStage: null,
    decisionWindows: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeTimeModel(model: TimeModel): {
  circadianCount: number;
  seasonalCount: number;
  decisionWindowCount: number;
  hasLifeStage: boolean;
  lifeStage: string | null;
  urgentWindows: number;
  soonWindows: number;
} {
  return {
    circadianCount: model.circadianPatterns.length,
    seasonalCount: model.seasonalPatterns.length,
    decisionWindowCount: model.decisionWindows.length,
    hasLifeStage: model.lifeStage !== null,
    lifeStage: model.lifeStage?.stage ?? null,
    urgentWindows: model.decisionWindows.filter((w) => w.urgency === "now" || w.urgency === "soon").length,
    soonWindows: model.decisionWindows.filter((w) => w.urgency === "soon").length,
  };
}