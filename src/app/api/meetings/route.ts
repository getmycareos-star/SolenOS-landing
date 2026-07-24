import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  MEETING_TYPES,
  classifyMeetingType,
  createMeeting,
  createProposedMeeting,
  detectProposedMeetingsFromText,
  listMeetingsForCaregiver,
  runMeetingPreparationTrigger,
  toMeetingPreparationLayerPayload,
} from "@/lib/meeting-preparation";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/meetings — list meetings; POST — create manual meeting */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  const trigger = req.nextUrl.searchParams.get("trigger");
  if (trigger === "1" || trigger === "true") {
    runMeetingPreparationTrigger(caregiverId);
  }

  const meetings = listMeetingsForCaregiver(caregiverId);
  return NextResponse.json({
    meetings,
    total: meetings.length,
    preparation_layers: meetings
      .filter((m) => m.preparation_pack)
      .map((m) => toMeetingPreparationLayerPayload(m))
      .filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const title = input.title;
  const datetime = input.datetime;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (typeof datetime !== "string" || !datetime.trim()) {
    return NextResponse.json({ error: "datetime required (ISO-8601)" }, { status: 400 });
  }

  const typeRaw = input.type;
  const type =
    typeof typeRaw === "string" && MEETING_TYPES.includes(typeRaw as (typeof MEETING_TYPES)[number])
      ? (typeRaw as (typeof MEETING_TYPES)[number])
      : classifyMeetingType(title.trim());

  if (input.detect_from_text === true && typeof input.source_text === "string") {
    const proposals = detectProposedMeetingsFromText({
      text: input.source_text,
      caregiver_id:
        typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID,
      case_id: typeof input.case_id === "string" ? input.case_id : null,
    });
    const created = proposals.map((p) => createProposedMeeting(p));
    return NextResponse.json({ proposed_meetings: created, total: created.length });
  }

  const meeting = createMeeting({
    title: title.trim(),
    type,
    datetime: datetime.trim(),
    caregiver_id:
      typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID,
    case_id: typeof input.case_id === "string" ? input.case_id : null,
    source: input.source === "calendar" ? "calendar" : "manual",
    linked_events: Array.isArray(input.linked_events)
      ? input.linked_events.filter((id): id is string => typeof id === "string")
      : undefined,
  });

  return NextResponse.json({ meeting });
}
