import {
  MEETING_PREPARATION_BOUNDARY,
  MEETING_PREPARATION_IDENTITY,
} from "./contract-constants";
import type { CaregivingMeeting, MeetingPreparationLayerPayload } from "./types";

export function toMeetingPreparationLayerPayload(
  meeting: CaregivingMeeting,
): MeetingPreparationLayerPayload | null {
  if (!meeting.preparation_pack) return null;
  return {
    identity: MEETING_PREPARATION_IDENTITY,
    boundary: MEETING_PREPARATION_BOUNDARY,
    meeting_id: meeting.id,
    meeting_title: meeting.title,
    meeting_type: meeting.type,
    meeting_datetime: meeting.datetime,
    preparation_pack: meeting.preparation_pack,
  };
}
