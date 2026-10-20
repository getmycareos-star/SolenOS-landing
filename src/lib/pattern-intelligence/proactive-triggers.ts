import type { JourneyGraphEvent } from "../care-journey-graph/types";
import { listMeetingsForCaregiver } from "../meeting-preparation/meeting-store";
import { isWithinPreparationWindow } from "../meeting-preparation/preparation-windows";
import {
  FOLLOW_UP_LOOKAHEAD_DAYS,
  INACTIVITY_THRESHOLD_DAYS,
} from "./contract-constants";
import type { DetectedPattern, PatternConfidence, ProactiveSignal } from "./types";

function createSignalId(): string {
  return `pro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function recentEvents(
  events: JourneyGraphEvent[],
  types: JourneyGraphEvent["event_type"][],
  days: number,
  now: Date,
): JourneyGraphEvent[] {
  return events.filter(
    (e) =>
      types.includes(e.event_type) &&
      daysSince(e.timestamp, now) <= days,
  );
}

export function detectInactivitySignal(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): ProactiveSignal | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const last = sorted[0]!;
  const days = daysSince(last.timestamp, now);

  if (days < INACTIVITY_THRESHOLD_DAYS) return null;

  return {
    id: createSignalId(),
    output_type: "missing_data_reminder",
    title: "No recent observations",
    message: `No observations recorded in the last ${Math.round(days)} days. This may reduce visibility into care changes.`,
    confidence: days >= 14 ? "high" : "medium",
    related_event_ids: [last.id],
    triggered_at: now.toISOString(),
  };
}

export function detectFollowUpSignals(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): ProactiveSignal[] {
  const signals: ProactiveSignal[] = [];

  const followUpEvents = events.filter(
    (e) =>
      /\b(follow[- ]?up|return visit|schedule appointment|review in)\b/i.test(
        `${e.title} ${e.description}`,
      ) ||
      (e.event_type === "doctor_recommendation" && e.resolved_status === "open"),
  );

  const scheduledAppts = events.filter(
    (e) => e.event_type === "appointment" && new Date(e.timestamp) >= now,
  );

  for (const fu of followUpEvents.slice(0, 3)) {
    const hasScheduled = scheduledAppts.some(
      (a) =>
        Math.abs(new Date(a.timestamp).getTime() - new Date(fu.timestamp).getTime()) <
        FOLLOW_UP_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000 * 4,
    );

    if (!hasScheduled && daysSince(fu.timestamp, now) <= 30) {
      signals.push({
        id: createSignalId(),
        output_type: "follow_up_reminder",
        title: "Follow-up may be needed",
        message:
          "A care record indicates follow-up may be required. No record found of scheduling confirmation.",
        confidence: "medium",
        related_event_ids: [fu.id],
        triggered_at: now.toISOString(),
      });
    }
  }

  return signals;
}

export function detectEventBasedSignals(
  events: JourneyGraphEvent[],
  now: Date = new Date(),
): ProactiveSignal[] {
  const signals: ProactiveSignal[] = [];

  const recentFalls = recentEvents(events, ["fall"], 7, now);
  if (recentFalls.length > 0) {
    signals.push({
      id: createSignalId(),
      output_type: "pattern_detected",
      title: "Recent fall recorded",
      message:
        "A fall was recently recorded in the care journey. This may be important to discuss at the next care appointment.",
      confidence: "high",
      related_event_ids: recentFalls.map((e) => e.id),
      triggered_at: now.toISOString(),
    });
  }

  const medChanges = recentEvents(
    events,
    ["medication_started", "medication_stopped"],
    7,
    now,
  );
  if (medChanges.length > 0) {
    signals.push({
      id: createSignalId(),
      output_type: "pattern_detected",
      title: "Recent medication change",
      message:
        "A medication change was recently recorded. Track any related observations in the care journey.",
      confidence: "high",
      related_event_ids: medChanges.map((e) => e.id),
      triggered_at: now.toISOString(),
    });
  }

  const hospital = recentEvents(events, ["hospital_visit", "emergency_visit"], 14, now);
  if (hospital.length > 0) {
    signals.push({
      id: createSignalId(),
      output_type: "pattern_detected",
      title: "Recent hospital or emergency visit",
      message:
        "A hospital or emergency visit was recently recorded. Follow-up items from discharge may need attention.",
      confidence: "high",
      related_event_ids: hospital.map((e) => e.id),
      triggered_at: now.toISOString(),
    });
  }

  return signals;
}

export function detectAppointmentNearSignals(
  caregiverId: string,
  now: Date = new Date(),
): ProactiveSignal[] {
  const meetings = listMeetingsForCaregiver(caregiverId);
  const signals: ProactiveSignal[] = [];

  for (const meeting of meetings) {
    if (meeting.status !== "scheduled") continue;
    if (!isWithinPreparationWindow(meeting.datetime, meeting.type, now)) continue;

    signals.push({
      id: createSignalId(),
      output_type: "appointment_near",
      title: `Upcoming: ${meeting.title}`,
      message: `A ${meeting.type.replace(/_/g, " ")} interaction is approaching. Review the preparation pack for context.`,
      confidence: "high",
      related_event_ids: meeting.linked_events,
      triggered_at: now.toISOString(),
    });
  }

  return signals;
}

export function detectRiskPatternAlert(
  patterns: DetectedPattern[],
  now: Date = new Date(),
): ProactiveSignal | null {
  const combo = patterns.filter(
    (p) =>
      p.pattern_type === "co_occurrence" ||
      (p.pattern_type === "trend" && p.confidence !== "low") ||
      (p.pattern_type === "frequency" && p.label.includes("fall")),
  );

  if (combo.length < 2) return null;

  const labels = combo.slice(0, 4).map((p) => `- ${p.label}`);
  return {
    id: createSignalId(),
    output_type: "risk_pattern_alert",
    title: "Multiple care changes detected",
    message: [
      "Multiple changes detected over the past 30 days:",
      ...labels,
      "",
      "This combination may be important to review at the next care appointment.",
    ].join("\n"),
    confidence: combo.some((p) => p.confidence === "high") ? "high" : "medium",
    related_event_ids: [...new Set(combo.flatMap((p) => p.event_ids))],
    triggered_at: now.toISOString(),
  };
}
