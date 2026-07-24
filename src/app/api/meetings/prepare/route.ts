import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  confirmProposedMeeting,
  getMeeting,
  prepareMeetingNow,
  recordMeetingOutcome,
  toMeetingPreparationLayerPayload,
} from "@/lib/meeting-preparation";

/** POST /api/meetings/prepare — generate preparation pack now */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const meetingId = input.meeting_id;

  if (typeof meetingId !== "string" || !meetingId.trim()) {
    return NextResponse.json({ error: "meeting_id required" }, { status: 400 });
  }

  const meeting = prepareMeetingNow(meetingId.trim());
  if (!meeting) {
    return NextResponse.json(
      { error: "Meeting not found or not eligible for preparation" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    meeting,
    layer: toMeetingPreparationLayerPayload(meeting),
  });
}

/** PATCH /api/meetings/prepare — confirm proposed meeting */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const meetingId = input.meeting_id;

  if (typeof meetingId !== "string") {
    return NextResponse.json({ error: "meeting_id required" }, { status: 400 });
  }

  const meeting = confirmProposedMeeting(meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "Proposed meeting not found" }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

/** PUT /api/meetings/prepare — complete meeting with outcome */
export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const meetingId = input.meeting_id;

  if (typeof meetingId !== "string") {
    return NextResponse.json({ error: "meeting_id required" }, { status: 400 });
  }

  const outcome = input.outcome;
  if (!outcome || typeof outcome !== "object") {
    return NextResponse.json({ error: "outcome object required" }, { status: 400 });
  }

  const o = outcome as Record<string, unknown>;
  const strArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const meeting = recordMeetingOutcome({
    meeting_id: meetingId,
    outcome: {
      decisions_made: strArray(o.decisions_made),
      advice_received: strArray(o.advice_received),
      responsibilities_assigned: strArray(o.responsibilities_assigned),
      follow_up_actions: strArray(o.follow_up_actions),
      new_questions: strArray(o.new_questions),
      documents_received: strArray(o.documents_received),
      deadlines_created: strArray(o.deadlines_created),
      notes: typeof o.notes === "string" ? o.notes : undefined,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

/** GET /api/meetings/prepare?meeting_id= */
export async function GET(req: NextRequest) {
  const meetingId = req.nextUrl.searchParams.get("meeting_id");
  if (!meetingId) {
    return NextResponse.json({ error: "meeting_id required" }, { status: 400 });
  }

  const meeting = getMeeting(meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    meeting,
    layer: toMeetingPreparationLayerPayload(meeting),
  });
}
