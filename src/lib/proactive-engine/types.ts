/**
 * Proactive engagement — check-ins, re-evaluation, anticipatory guidance.
 *
 * Everything happens in response to input. This layer adds the missing
 * proactive capability: when to reach out, when to re-evaluate open
 * questions, and what to say before the caregiver asks.
 */

export const PROACTIVE_ENGINE_VERSION = "1.0.0";

export type CheckInSchedule = {
  id: string;
  careRecipientId: string;
  trigger: "time_based" | "risk_based" | "pattern_based" | "outcome_based";
  triggerDetail: string;
  /** When to check in. */
  scheduledAt: string;
  /** What to ask. */
  questions: string[];
  /** Why this check-in matters. */
  rationale: string;
  /** What would happen if we don't check in. */
  riskOfNotChecking: string;
  status: "scheduled" | "sent" | "responded" | "cancelled" | "overdue";
  createdAt: string;
};

export type ReEvaluationSchedule = {
  id: string;
  careRecipientId: string;
  /** What to re-evaluate. */
  topic: string;
  /** When to re-evaluate. */
  scheduledAt: string;
  /** What would trigger earlier re-evaluation. */
  earlyTriggers: string[];
  /** What would cancel the re-evaluation. */
  cancelTriggers: string[];
  status: "scheduled" | "completed" | "cancelled" | "overdue";
  createdAt: string;
};

export type AnticipatoryGuidance = {
  id: string;
  careRecipientId: string;
  /** What is likely to happen next. */
  likelyNext: string;
  /** Based on what. */
  basedOn: string[];
  /** What the caregiver might want to prepare for. */
  preparationSuggestions: string[];
  /** When this guidance might change. */
  validUntil: string | null;
  confidence: number;
  source: "inferred" | "pattern_based";
  createdAt: string;
};

export type ProactiveEngine = {
  version: string;
  careRecipientId: string;
  checkIns: CheckInSchedule[];
  reEvaluations: ReEvaluationSchedule[];
  anticipatoryGuidance: AnticipatoryGuidance[];
  createdAt: string;
  updatedAt: string;
};

export function createEmptyProactiveEngine(careRecipientId: string, createdAt?: string): ProactiveEngine {
  const now = createdAt ?? new Date().toISOString();
  return {
    version: PROACTIVE_ENGINE_VERSION,
    careRecipientId,
    checkIns: [],
    reEvaluations: [],
    anticipatoryGuidance: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeProactive(engine: ProactiveEngine): {
  scheduledCheckIns: number;
  overdueCheckIns: number;
  scheduledReEvaluations: number;
  anticipatoryGuidanceCount: number;
  hasUpcomingCheckIns: boolean;
  hasUpcomingReEvaluations: boolean;
  hasAnticipatoryGuidance: boolean;
} {
  const now = new Date();
  const scheduled = engine.checkIns.filter((c) => c.status === "scheduled" && new Date(c.scheduledAt) > now).length;
  const overdue = engine.checkIns.filter((c) => c.status === "scheduled" && new Date(c.scheduledAt) <= now).length;
  const reScheduled = engine.reEvaluations.filter((r) => r.status === "scheduled" && new Date(r.scheduledAt) > now).length;
  return {
    scheduledCheckIns: scheduled,
    overdueCheckIns: overdue,
    scheduledReEvaluations: reScheduled,
    anticipatoryGuidanceCount: engine.anticipatoryGuidance.length,
    hasUpcomingCheckIns: scheduled > 0,
    hasUpcomingReEvaluations: reScheduled > 0,
    hasAnticipatoryGuidance: engine.anticipatoryGuidance.length > 0,
  };
}