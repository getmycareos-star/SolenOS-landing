import { NextResponse } from "next/server";
import { insertSolenEvent } from "@/lib/ops-console/insert-event";

/**
 * POST /api/track — lightweight event ingestion. No aggregation.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const event_name = input.event_name;
  const session_id = input.session_id;

  if (typeof event_name !== "string" || !event_name.trim()) {
    return NextResponse.json({ success: false, error: "event_name required" }, { status: 400 });
  }
  if (typeof session_id !== "string" || !session_id.trim()) {
    return NextResponse.json({ success: false, error: "session_id required" }, { status: 400 });
  }

  const user_id =
    input.user_id === null || input.user_id === undefined
      ? null
      : typeof input.user_id === "string"
        ? input.user_id
        : null;

  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};

  await insertSolenEvent({
    user_id,
    event_name: event_name.trim(),
    session_id: session_id.trim(),
    metadata,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
