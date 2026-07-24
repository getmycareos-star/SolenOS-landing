import type { CanonicalCareEvent } from "../situation-entry/types";
import { buildMetricScore } from "./scoring";
import type { MetricScore } from "./types";

export function measureCognitiveLoadReduction(input: {
  totalEvents: number;
  contextWindowChars: number;
  unresolvedVisible: number;
  memoryRetrievalOrder: string[];
  caregiverRemembersViaSystem: boolean;
}): MetricScore {
  const signals: string[] = [];
  let score = 30;

  if (input.totalEvents >= 5) {
    score += 20;
    signals.push("Care history externalized — less to retain in memory");
  }

  if (input.contextWindowChars > 0) {
    score += 15;
    signals.push("Structured context available without manual recall");
  }

  if (input.memoryRetrievalOrder.length >= 3) {
    score += 15;
    signals.push("Prioritized retrieval reduces search effort");
  }

  if (input.unresolvedVisible > 0) {
    score += 10;
    signals.push(`${input.unresolvedVisible} unresolved item(s) visible — not held in memory`);
  } else if (input.totalEvents > 0) {
    score += 5;
    signals.push("No critical gaps requiring mental tracking");
  }

  if (input.caregiverRemembersViaSystem) {
    score += 15;
    signals.push("Caregiver can rely on SolenOS to remember the journey");
  }

  return buildMetricScore("cognitive_load_reduction", score, signals);
}

export function measureContinuityRestoration(input: {
  events: CanonicalCareEvent[];
  whatChanged: string[];
  unresolvedVisible: string[];
  linkedEventPct: number;
  hasActiveEpisode: boolean;
}): MetricScore {
  const signals: string[] = [];
  let score = 20;

  if (input.whatChanged.length > 0) {
    score += 25;
    signals.push("What changed surfaced immediately on return");
  }

  if (input.hasActiveEpisode) {
    score += 20;
    signals.push("Active episode provides instant context");
  }

  if (input.linkedEventPct >= 0.5) {
    score += 20;
    signals.push(`${Math.round(input.linkedEventPct * 100)}% of events connected`);
  }

  if (input.unresolvedVisible.length > 0) {
    score += 15;
    signals.push(`${input.unresolvedVisible.length} unresolved item(s) visible`);
  }

  if (input.events.length >= 3) {
    score += 10;
    signals.push("Sufficient history to restore journey state");
  }

  return buildMetricScore("continuity_restoration", score, signals);
}
