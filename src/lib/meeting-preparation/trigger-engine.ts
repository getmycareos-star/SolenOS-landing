import { processCareJourneyInput } from "../care-journey-graph/pipeline";
import { attachPreparationPack, completeMeeting, getMeeting, listMeetingsForCaregiver } from "./meeting-store";
import { generatePreparationPack } from "./generate-pack";
import { isWithinPreparationWindow } from "./preparation-windows";
import type { CaregivingMeeting, CompleteMeetingInput, MeetingOutcome } from "./types";

export type TriggerResult = {
  checked: number;
  generated: CaregivingMeeting[];
};

/**
 * Time-based scheduler — generates packs for scheduled meetings within preparation window.
 */
export function runMeetingPreparationTrigger(
  caregiverId: string,
  now: Date = new Date(),
): TriggerResult {
  const meetings = listMeetingsForCaregiver(caregiverId);
  const generated: CaregivingMeeting[] = [];

  for (const meeting of meetings) {
    if (meeting.status !== "scheduled") continue;
    if (meeting.preparation_generated) continue;
    if (!isWithinPreparationWindow(meeting.datetime, meeting.type, now)) continue;

    const pack = generatePreparationPack(meeting);
    const updated = attachPreparationPack(meeting.id, pack);
    if (updated) generated.push(updated);
  }

  return { checked: meetings.length, generated };
}

export function prepareMeetingNow(meetingId: string): CaregivingMeeting | undefined {
  const meeting = getMeeting(meetingId);
  if (!meeting || meeting.status !== "scheduled") return undefined;

  const pack = generatePreparationPack(meeting);
  return attachPreparationPack(meetingId, pack);
}

/**
 * After meeting completion — feed outcome back into Care Journey.
 */
export function recordMeetingOutcome(input: CompleteMeetingInput): CaregivingMeeting | undefined {
  const meeting = getMeeting(input.meeting_id);
  if (!meeting) return undefined;

  const completed = completeMeeting(input.meeting_id, input.outcome);
  if (!completed) return undefined;

  const parts: string[] = [];
  if (input.outcome.decisions_made.length) {
    parts.push(`Decisions: ${input.outcome.decisions_made.join("; ")}`);
  }
  if (input.outcome.advice_received.length) {
    parts.push(`Advice: ${input.outcome.advice_received.join("; ")}`);
  }
  if (input.outcome.follow_up_actions.length) {
    parts.push(`Follow-up: ${input.outcome.follow_up_actions.join("; ")}`);
  }
  if (input.outcome.notes?.trim()) {
    parts.push(input.outcome.notes.trim());
  }

  if (parts.length > 0) {
    processCareJourneyInput({
      description: `Meeting completed — ${meeting.title}. ${parts.join(". ")}`,
      caregiver_id: meeting.caregiver_id,
      case_id: meeting.case_id,
      source: "meeting_outcome",
      timestamp: new Date().toISOString(),
      metadata: {
        meeting_id: meeting.id,
        meeting_type: meeting.type,
        outcome: input.outcome,
      },
    });
  }

  for (const question of input.outcome.new_questions) {
    if (!question.trim()) continue;
    processCareJourneyInput({
      description: `Open question from ${meeting.title}: ${question.trim()}`,
      caregiver_id: meeting.caregiver_id,
      case_id: meeting.case_id,
      source: "meeting_outcome",
    });
  }

  return completed;
}

export function buildEmptyOutcome(): MeetingOutcome {
  return {
    decisions_made: [],
    advice_received: [],
    responsibilities_assigned: [],
    follow_up_actions: [],
    new_questions: [],
    documents_received: [],
    deadlines_created: [],
  };
}
