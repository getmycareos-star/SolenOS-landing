import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  applyCorrection,
  confirmCandidate,
  getDareProjection,
  DARE_IDENTITY,
  validatedToCanonical,
} from "@/lib/data-acquisition-resilience";
import {
  appendEventsToContext,
  applyUserCorrectionInContext,
  invalidateEventInContext,
  updateEventTimeInContext,
} from "@/lib/situation-entry/context-store";
import { processSituationRecompile } from "@/lib/situation-entry";
import { getAuditTrailForEvent, INTEGRITY_IDENTITY } from "@/lib/care-event-integrity";
import type { EventTime } from "@/lib/time-model";
import { createExactEventTime, parseEventTimeFromText } from "@/lib/time-model";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

function parseEventTimeFromBody(record: Record<string, unknown>): EventTime | null {
  if (record.event_time && typeof record.event_time === "object") {
    const et = record.event_time as Record<string, unknown>;
    if (
      typeof et.type === "string" &&
      ["exact", "approximate", "range", "unknown"].includes(et.type)
    ) {
      return {
        type: et.type as EventTime["type"],
        start: typeof et.start === "string" ? et.start : undefined,
        end: typeof et.end === "string" ? et.end : undefined,
        confidence: typeof et.confidence === "number" ? et.confidence : 0.5,
      };
    }
  }
  if (typeof record.event_time_text === "string" && record.event_time_text.trim()) {
    return parseEventTimeFromText(record.event_time_text.trim()).event_time;
  }
  if (typeof record.event_time_iso === "string" && record.event_time_iso.trim()) {
    return createExactEventTime(record.event_time_iso.trim());
  }
  return null;
}

/** POST /api/situation/correct — user correction loop + integrity actions */
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

  const record = body as Record<string, unknown>;
  const caregiverId =
    typeof record.caregiver_id === "string" ? record.caregiver_id : DEFAULT_CAREGIVER_ID;

  if (record.action === "retime" && typeof record.target_event_id === "string") {
    const newEventTime = parseEventTimeFromBody(record);
    if (!newEventTime) {
      return NextResponse.json(
        { error: "event_time, event_time_text, or event_time_iso required for retime" },
        { status: 400 },
      );
    }

    const result = updateEventTimeInContext(caregiverId, record.target_event_id, newEventTime);
    if (!result) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const recompiled = await processSituationRecompile({
      caregiver_id: caregiverId,
      trigger: "correction",
      correction_event_id: record.target_event_id,
    });

    return NextResponse.json({
      identity: INTEGRITY_IDENTITY,
      action: "retime",
      correction: result.correction,
      context: result.context,
      situation: recompiled,
    });
  }

  if (
    (record.action === "invalidate" || record.correction_type === "delete") &&
    typeof record.target_event_id === "string"
  ) {
    applyCorrection({
      caregiver_id: caregiverId,
      target_event_id: record.target_event_id,
      correction_type: "delete",
      corrected_fields:
        record.corrected_fields && typeof record.corrected_fields === "object"
          ? (record.corrected_fields as Record<string, unknown>)
          : {},
      user_source: typeof record.user_source === "string" ? record.user_source : "user",
    });

    const result = invalidateEventInContext(
      caregiverId,
      record.target_event_id,
      typeof record.reason === "string" ? record.reason : "user_correction",
    );
    if (!result) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const recompiled = await processSituationRecompile({
      caregiver_id: caregiverId,
      trigger: "correction",
      correction_event_id: record.target_event_id,
    });

    return NextResponse.json({
      identity: INTEGRITY_IDENTITY,
      action: "invalidate",
      event: result.event,
      context: result.context,
      audit_trail: getAuditTrailForEvent(record.target_event_id),
      situation: recompiled,
    });
  }

  if (record.action === "confirm" && typeof record.candidate_id === "string") {
    const event = confirmCandidate(record.candidate_id, caregiverId);
    if (event) {
      appendEventsToContext(caregiverId, [validatedToCanonical(event)]);
    }
    return NextResponse.json({
      identity: DARE_IDENTITY,
      action: "confirm",
      validated_event: event,
      projection: getDareProjection(caregiverId),
    });
  }

  const correctionType = record.correction_type;
  if (
    correctionType !== "modify" &&
    correctionType !== "delete" &&
    correctionType !== "merge" &&
    correctionType !== "clarify"
  ) {
    return NextResponse.json({ error: "correction_type required" }, { status: 400 });
  }

  const result = applyCorrection({
    caregiver_id: caregiverId,
    target_event_id: typeof record.target_event_id === "string" ? record.target_event_id : null,
    target_candidate_id:
      typeof record.target_candidate_id === "string" ? record.target_candidate_id : null,
    correction_type: correctionType,
    corrected_fields:
      record.corrected_fields && typeof record.corrected_fields === "object"
        ? (record.corrected_fields as Record<string, unknown>)
        : {},
    user_source: typeof record.user_source === "string" ? record.user_source : "user",
  });

  if (correctionType === "modify" && typeof record.target_event_id === "string") {
    const ctxResult = applyUserCorrectionInContext(
      caregiverId,
      record.target_event_id,
      result.correction.corrected_fields,
    );
    if (ctxResult) {
      const recompiled = await processSituationRecompile({
        caregiver_id: caregiverId,
        trigger: "correction",
        correction_event_id: record.target_event_id,
      });

      return NextResponse.json({
        identity: INTEGRITY_IDENTITY,
        correction: result.correction,
        updated_event: result.updated_event,
        context: ctxResult.context,
        canonical_event: ctxResult.event,
        audit_trail: getAuditTrailForEvent(record.target_event_id),
        projection: getDareProjection(caregiverId),
        situation: recompiled,
      });
    }
  }

  if (result.updated_event && correctionType !== "delete") {
    appendEventsToContext(caregiverId, [validatedToCanonical(result.updated_event)]);
  }

  return NextResponse.json({
    identity: INTEGRITY_IDENTITY,
    correction: result.correction,
    updated_event: result.updated_event,
    deleted_event_id: result.deleted_event_id,
    projection: getDareProjection(caregiverId),
  });
}

/** GET /api/situation/correct — DARE projection + integrity audit */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const eventId = req.nextUrl.searchParams.get("event_id");

  return NextResponse.json({
    identity: INTEGRITY_IDENTITY,
    projection: getDareProjection(caregiverId),
    audit_trail: eventId ? getAuditTrailForEvent(eventId) : undefined,
  });
}
