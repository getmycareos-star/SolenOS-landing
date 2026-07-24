import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  completePendingProcessing,
  FAILURE_RESILIENCE_IDENTITY,
  getPendingProcessing,
  getRetryablePending,
  markRetryAttempt,
} from "@/lib/failure-resilience";
import { processSituationInput } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/recover — pending processing queue */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  return NextResponse.json({
    identity: FAILURE_RESILIENCE_IDENTITY,
    pending: getPendingProcessing(caregiverId),
    retryable: getRetryablePending(caregiverId),
  });
}

/** POST /api/situation/recover — retry deferred processing or mark complete */
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

  if (record.action === "retry" && typeof record.pending_id === "string") {
    const attempt = markRetryAttempt(caregiverId, record.pending_id);
    if (!attempt) {
      return NextResponse.json({ error: "Pending item not found" }, { status: 404 });
    }

    const rawContent =
      typeof record.raw_input === "string" ? record.raw_input : attempt.content_preview;

    const result = await processSituationInput({
      raw_input: rawContent,
      caregiver_id: caregiverId,
    });

    if (result.failure_resilience_layer?.processing_status !== "pending") {
      completePendingProcessing(caregiverId, record.pending_id, "complete");
    }

    return NextResponse.json({
      identity: FAILURE_RESILIENCE_IDENTITY,
      action: "retry",
      attempt,
      situation: result,
    });
  }

  if (record.action === "defer" && typeof record.pending_id === "string") {
    const deferred = completePendingProcessing(caregiverId, record.pending_id, "deferred");
    if (!deferred) {
      return NextResponse.json({ error: "Pending item not found" }, { status: 404 });
    }

    return NextResponse.json({
      identity: FAILURE_RESILIENCE_IDENTITY,
      action: "defer",
      pending: deferred,
    });
  }

  return NextResponse.json(
    { error: "action must be retry or defer with pending_id" },
    { status: 400 },
  );
}
