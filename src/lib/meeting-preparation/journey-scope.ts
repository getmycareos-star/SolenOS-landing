import { EVENT_TYPE_LABELS } from "../care-journey-graph/classify-event";
import type { JourneyEventType, JourneyGraphEvent } from "../care-journey-graph/types";
import type { MeetingType } from "./types";

const MEDICAL_EVENTS: JourneyEventType[] = [
  "diagnosis",
  "medication_started",
  "medication_stopped",
  "symptom",
  "behaviour_change",
  "appointment",
  "doctor_recommendation",
  "lab_result",
  "hospital_visit",
  "fall",
  "emergency_visit",
];
const LEGAL_EVENTS: JourneyEventType[] = ["legal_document", "decision"];
const FINANCIAL_EVENTS: JourneyEventType[] = ["insurance_update", "decision", "administrative"];
const CARE_COORD_EVENTS: JourneyEventType[] = [
  "care_goal",
  "caregiver_observation",
  "administrative",
  "doctor_recommendation",
];
const FAMILY_EVENTS: JourneyEventType[] = ["family_conversation", "decision", "care_goal"];

const TYPE_EVENT_MAP: Record<MeetingType, JourneyEventType[]> = {
  medical: MEDICAL_EVENTS,
  legal: LEGAL_EVENTS,
  financial: FINANCIAL_EVENTS,
  care_coordination: CARE_COORD_EVENTS,
  family: FAMILY_EVENTS,
  other: [],
};

function formatTimelineEntry(event: JourneyGraphEvent): string {
  const date = new Date(event.timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${date} — ${EVENT_TYPE_LABELS[event.event_type]}: ${event.title}`;
}

function eventRelevantToMeeting(event: JourneyGraphEvent, meetingType: MeetingType): boolean {
  const allowed = TYPE_EVENT_MAP[meetingType];
  if (meetingType === "other") return true;
  return allowed.includes(event.event_type);
}

function isInWindow(event: JourneyGraphEvent, start: string, end: string): boolean {
  return event.timestamp >= start && event.timestamp <= end;
}

function changeSummary(event: JourneyGraphEvent): string | null {
  switch (event.event_type) {
    case "medication_started":
    case "medication_stopped":
      return `Medication change: ${event.title}`;
    case "diagnosis":
      return `New diagnosis recorded: ${event.title}`;
    case "symptom":
    case "behaviour_change":
      return `${EVENT_TYPE_LABELS[event.event_type]}: ${event.title}`;
    case "fall":
      return `Fall occurred: ${event.title}`;
    case "legal_document":
      return `Legal document completed: ${event.title}`;
    case "insurance_update":
      return `Insurance update: ${event.title}`;
    case "family_conversation":
      return `Family responsibility discussion: ${event.title}`;
    case "decision":
      return `Decision made: ${event.title}`;
    default:
      if (event.clinical_importance === "high") {
        return `${EVENT_TYPE_LABELS[event.event_type]}: ${event.title}`;
      }
      return null;
  }
}

export function deriveDiscussionTopics(params: {
  meetingType: MeetingType;
  events: JourneyGraphEvent[];
  unanswered: string[];
  changes: string[];
}): string[] {
  const topics: string[] = [];
  const { meetingType, events, unanswered, changes } = params;

  const hasMedChange = events.some((e) =>
    ["medication_started", "medication_stopped"].includes(e.event_type),
  );
  const hasSymptom = events.some((e) =>
    ["symptom", "behaviour_change"].includes(e.event_type),
  );
  const hasLegal = events.some((e) => e.event_type === "legal_document");
  const hasInsurance = events.some((e) => e.event_type === "insurance_update");
  const hasFamily = events.some((e) => e.event_type === "family_conversation");

  if (meetingType === "medical") {
    if (hasMedChange) topics.push("Review medication effectiveness and recent changes");
    if (hasSymptom) topics.push("Discuss new or worsening symptoms since last visit");
    if (events.some((e) => e.event_type === "lab_result")) {
      topics.push("Review pending or recent test results");
    }
    if (unanswered.length > 0) topics.push(`Unresolved: ${unanswered[0]}`);
  }

  if (meetingType === "legal") {
    if (hasLegal) topics.push("Confirm Power of Attorney and legal authority status");
    topics.push("Review guardianship or estate planning needs");
    if (changes.some((c) => /legal/i.test(c))) topics.push("Discuss recent legal document changes");
  }

  if (meetingType === "financial") {
    if (hasInsurance) topics.push("Review outstanding claims and coverage decisions");
    topics.push("Confirm missing documentation or billing issues");
    if (events.some((e) => /\b(denied|appeal|not covered)\b/i.test(e.description))) {
      topics.push("Discuss insurance appeal status");
    }
  }

  if (meetingType === "family") {
    if (hasFamily) topics.push("Review care responsibility distribution");
    topics.push("Upcoming appointments and shared duties");
    topics.push("Support gaps and financial planning needs");
  }

  if (meetingType === "care_coordination") {
    topics.push("Home care availability and service changes");
    if (events.some((e) => e.event_type === "care_goal")) {
      topics.push("Review updated care plan goals");
    }
    topics.push("Follow-through on case manager recommendations");
  }

  if (meetingType === "other" && changes.length > 0) {
    topics.push(`Follow up on: ${changes[0]}`);
  }

  return [...new Set(topics)].slice(0, 6);
}

export function extractMonitoringItems(events: JourneyGraphEvent[]): string[] {
  const monitors = new Set<string>();
  const patterns: [RegExp, string][] = [
    [/\bmobil\w*\b/i, "Mobility"],
    [/\bappetite|eating\b/i, "Appetite"],
    [/\bsleep\b/i, "Sleep"],
    [/\bconfus\w*\b/i, "Confusion"],
    [/\bweight\b/i, "Weight"],
    [/\bmood\b/i, "Mood"],
    [/\bpain\b/i, "Pain"],
    [/\bhome care\b/i, "Home care availability"],
    [/\binsurance|approval\b/i, "Financial approvals"],
  ];

  for (const event of events) {
    if (event.resolved_status !== "open") continue;
    const haystack = `${event.title} ${event.description}`;
    for (const [pattern, label] of patterns) {
      if (pattern.test(haystack)) monitors.add(label);
    }
  }

  return [...monitors].slice(0, 8);
}

export {
  formatTimelineEntry,
  eventRelevantToMeeting,
  isInWindow,
  changeSummary,
};
