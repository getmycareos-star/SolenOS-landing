import { getGraphForCaregiver } from "../care-journey-graph/graph-store";
import { EVENT_TYPE_LABELS } from "../care-journey-graph/classify-event";
import type { JourneyGraphEvent } from "../care-journey-graph/types";
import {
  changeSummary,
  deriveDiscussionTopics,
  eventRelevantToMeeting,
  extractMonitoringItems,
  formatTimelineEntry,
  isInWindow,
} from "./journey-scope";
import { listMeetingsForCaregiver } from "./meeting-store";
import type { CaregivingMeeting, PreparationPack } from "./types";

function findLastSimilarMeeting(
  meeting: CaregivingMeeting,
  allMeetings: CaregivingMeeting[],
): CaregivingMeeting | null {
  const prior = allMeetings
    .filter(
      (m) =>
        m.id !== meeting.id &&
        m.type === meeting.type &&
        m.status === "completed" &&
        m.datetime < meeting.datetime,
    )
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
  return prior[0] ?? null;
}

function collectLinkedChainEvents(
  seedEvents: JourneyGraphEvent[],
  allEvents: JourneyGraphEvent[],
  relationships: { from_event_id: string; to_event_id: string }[],
): JourneyGraphEvent[] {
  const ids = new Set(seedEvents.map((e) => e.id));
  for (const rel of relationships) {
    if (ids.has(rel.from_event_id) || ids.has(rel.to_event_id)) {
      const from = allEvents.find((e) => e.id === rel.from_event_id);
      const to = allEvents.find((e) => e.id === rel.to_event_id);
      if (from) ids.add(from.id);
      if (to) ids.add(to.id);
    }
  }
  return allEvents.filter((e) => ids.has(e.id));
}

/**
 * Generate preparation pack from Care Journey only — no invented facts.
 */
export function generatePreparationPack(meeting: CaregivingMeeting): PreparationPack {
  const now = new Date().toISOString();
  const graph = getGraphForCaregiver(meeting.caregiver_id, meeting.case_id);
  const allEvents = graph?.events ?? [];
  const relationships = graph?.relationships ?? [];

  const allMeetings = listMeetingsForCaregiver(meeting.caregiver_id);
  const lastSimilar = findLastSimilarMeeting(meeting, allMeetings);
  const startTime = lastSimilar?.datetime ?? "1970-01-01T00:00:00.000Z";
  const endTime = now;

  const windowEvents = allEvents
    .filter((e) => isInWindow(e, startTime, endTime))
    .filter((e) => eventRelevantToMeeting(e, meeting.type));

  const scopedEvents = collectLinkedChainEvents(windowEvents, allEvents, relationships);

  const what_changed = scopedEvents
    .map(changeSummary)
    .filter((c): c is string => !!c);
  const uniqueChanges = [...new Set(what_changed)].slice(0, 10);

  const timeline_since_last_meeting = scopedEvents
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(formatTimelineEntry)
    .slice(-12);

  const outstanding_followups: string[] = [];
  for (const event of allEvents) {
    if (event.resolved_status !== "open") continue;
    if (event.event_type === "doctor_recommendation") {
      outstanding_followups.push(`Open recommendation: ${event.title}`);
    }
    if (event.event_type === "lab_result" && event.resolved_status === "open") {
      outstanding_followups.push(`Pending result: ${event.title}`);
    }
    if (/\b(pending|not scheduled|awaiting|incomplete)\b/i.test(event.description)) {
      outstanding_followups.push(event.title);
    }
  }

  const unanswered_questions: string[] = [];
  for (const event of allEvents) {
    if (event.event_type === "question" && event.resolved_status === "open") {
      unanswered_questions.push(event.description || event.title);
    }
    unanswered_questions.push(...event.open_questions.filter((q) => q.length > 0));
  }

  const decisions_made = scopedEvents
    .filter((e) => e.event_type === "decision" || e.event_type === "medication_started" || e.event_type === "medication_stopped" || e.event_type === "legal_document")
    .map((e) => `${EVENT_TYPE_LABELS[e.event_type]}: ${e.title}`)
    .slice(0, 8);

  const items_being_monitored = extractMonitoringItems(
    allEvents.filter((e) => isInWindow(e, startTime, endTime)),
  );

  const suggested_discussion_topics = deriveDiscussionTopics({
    meetingType: meeting.type,
    events: scopedEvents,
    unanswered: [...new Set(unanswered_questions)].slice(0, 5),
    changes: uniqueChanges,
  });

  return {
    meeting_id: meeting.id,
    generated_at: now,
    what_changed: uniqueChanges,
    timeline_since_last_meeting,
    outstanding_followups: [...new Set(outstanding_followups)].slice(0, 8),
    unanswered_questions: [...new Set(unanswered_questions)].slice(0, 8),
    items_being_monitored,
    decisions_made,
    suggested_discussion_topics,
    last_similar_meeting_at: lastSimilar?.datetime ?? null,
    events_in_scope: scopedEvents.length,
  };
}
