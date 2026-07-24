import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { recordEventOutcome } from "@/lib/care-record";
import { OUTCOME_STATUSES } from "@/lib/care-record/types";

/** POST /api/care-record/outcome — Event → Decision → Outcome linkage */
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
  const eventId = input.event_id;
  const status = input.status;
  const summary = input.summary;

  if (typeof eventId !== "string" || !eventId.trim()) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }
  if (typeof status !== "string" || !OUTCOME_STATUSES.includes(status as (typeof OUTCOME_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (typeof summary !== "string" || !summary.trim()) {
    return NextResponse.json({ error: "summary required" }, { status: 400 });
  }

  const result = recordEventOutcome({
    event_id: eventId,
    status: status as (typeof OUTCOME_STATUSES)[number],
    summary: summary.trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
