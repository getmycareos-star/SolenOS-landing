import { preparationWindowHours } from "./preparation-windows";
import type {
  CaregivingMeeting,
  CreateMeetingInput,
  MeetingOutcome,
  PreparationPack,
  ProposedMeetingInput,
} from "./types";

const meetings = new Map<string, CaregivingMeeting>();
const caregiverIndex = new Map<string, string[]>();

function createMeetingId(): string {
  return `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function indexMeeting(meeting: CaregivingMeeting): void {
  const existing = caregiverIndex.get(meeting.caregiver_id) ?? [];
  if (!existing.includes(meeting.id)) {
    caregiverIndex.set(meeting.caregiver_id, [meeting.id, ...existing]);
  }
}

export function createMeeting(input: CreateMeetingInput): CaregivingMeeting {
  const now = new Date().toISOString();
  const caregiverId = input.caregiver_id ?? "default_caregiver";
  const meeting: CaregivingMeeting = {
    id: createMeetingId(),
    title: input.title.trim(),
    type: input.type,
    datetime: input.datetime,
    status: "scheduled",
    source: input.source ?? "manual",
    caregiver_id: caregiverId,
    case_id: input.case_id ?? null,
    linked_events: input.linked_events ?? [],
    preparation_generated: false,
    preparation_pack: null,
    requires_user_confirmation: false,
    preparation_window_hours: preparationWindowHours(input.type),
    outcome: null,
    created_at: now,
    updated_at: now,
  };
  meetings.set(meeting.id, meeting);
  indexMeeting(meeting);
  return meeting;
}

export function createProposedMeeting(input: ProposedMeetingInput): CaregivingMeeting {
  const now = new Date().toISOString();
  const caregiverId = input.caregiver_id ?? "default_caregiver";
  const meeting: CaregivingMeeting = {
    id: createMeetingId(),
    title: input.title.trim(),
    type: input.type,
    datetime: input.datetime,
    status: "proposed_meeting",
    source: "document_inferred",
    caregiver_id: caregiverId,
    case_id: input.case_id ?? null,
    linked_events: input.linked_events ?? [],
    preparation_generated: false,
    preparation_pack: null,
    requires_user_confirmation: true,
    preparation_window_hours: preparationWindowHours(input.type),
    outcome: null,
    created_at: now,
    updated_at: now,
  };
  meetings.set(meeting.id, meeting);
  indexMeeting(meeting);
  return meeting;
}

export function confirmProposedMeeting(meetingId: string): CaregivingMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.status !== "proposed_meeting") return undefined;
  const updated: CaregivingMeeting = {
    ...meeting,
    status: "scheduled",
    requires_user_confirmation: false,
    updated_at: new Date().toISOString(),
  };
  meetings.set(meetingId, updated);
  return updated;
}

export function getMeeting(meetingId: string): CaregivingMeeting | undefined {
  return meetings.get(meetingId);
}

export function listMeetingsForCaregiver(caregiverId: string): CaregivingMeeting[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids
    .map((id) => meetings.get(id))
    .filter((m): m is CaregivingMeeting => !!m)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

export function attachPreparationPack(
  meetingId: string,
  pack: PreparationPack,
): CaregivingMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting) return undefined;
  const updated: CaregivingMeeting = {
    ...meeting,
    preparation_generated: true,
    preparation_pack: pack,
    updated_at: new Date().toISOString(),
  };
  meetings.set(meetingId, updated);
  return updated;
}

export function completeMeeting(
  meetingId: string,
  outcome: MeetingOutcome,
): CaregivingMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting) return undefined;
  const updated: CaregivingMeeting = {
    ...meeting,
    status: "completed",
    outcome,
    updated_at: new Date().toISOString(),
  };
  meetings.set(meetingId, updated);
  return updated;
}

export function cancelMeeting(meetingId: string): CaregivingMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting) return undefined;
  const updated: CaregivingMeeting = {
    ...meeting,
    status: "cancelled",
    updated_at: new Date().toISOString(),
  };
  meetings.set(meetingId, updated);
  return updated;
}

export function resetMeetingStore(): void {
  meetings.clear();
  caregiverIndex.clear();
}
