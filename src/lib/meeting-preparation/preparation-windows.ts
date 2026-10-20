import { PREPARATION_WINDOWS_HOURS, PROPOSED_MEETING_PATTERNS } from "./contract-constants";
import { classifyMeetingType } from "./classify-meeting-type";
import type { MeetingType, ProposedMeetingInput } from "./types";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function preparationWindowHours(type: MeetingType): number {
  return PREPARATION_WINDOWS_HOURS[type];
}

export function isWithinPreparationWindow(
  meetingDatetime: string,
  type: MeetingType,
  now: Date = new Date(),
): boolean {
  const windowMs = preparationWindowHours(type) * 60 * 60 * 1000;
  const meetingTime = new Date(meetingDatetime).getTime();
  const nowTime = now.getTime();
  return nowTime >= meetingTime - windowMs && nowTime < meetingTime;
}

/**
 * Detect proposed meetings from document text — NEVER auto-schedule.
 * Returns suggestions requiring user confirmation.
 */
export function detectProposedMeetingsFromText(params: {
  text: string;
  caregiver_id?: string;
  case_id?: string | null;
  reference_date?: string;
}): ProposedMeetingInput[] {
  const proposals: ProposedMeetingInput[] = [];
  const text = params.text.trim();
  if (!text) return proposals;

  const refDate = params.reference_date ?? new Date().toISOString();

  for (const pattern of PROPOSED_MEETING_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    for (const match of text.matchAll(globalPattern)) {
      const excerpt = match[0]?.trim() ?? "";
      if (!excerpt) continue;

      let datetime = refDate;
      const daysMatch = excerpt.match(/follow[- ]?up in (\d+) days?/i);
      if (daysMatch?.[1]) {
        datetime = addDays(refDate, Number.parseInt(daysMatch[1], 10));
      } else {
        datetime = addDays(refDate, 14);
      }

      const title = excerpt.length <= 80 ? excerpt : `${excerpt.slice(0, 77)}…`;
      proposals.push({
        title: `Suggested: ${title}`,
        type: classifyMeetingType(excerpt),
        datetime,
        caregiver_id: params.caregiver_id,
        case_id: params.case_id,
        source_text_excerpt: excerpt,
      });
    }
  }

  const seen = new Set<string>();
  return proposals.filter((p) => {
    const key = `${p.title}:${p.datetime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
