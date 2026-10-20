import { NextRequest, NextResponse } from "next/server";
import { insertSolenEvent } from "@/lib/ops-console/insert-event";
import { isOpsEventName } from "@/lib/ops-console/event-names";
import { withAuthentication } from '@/lib/auth/middleware';

export const runtime = "nodejs";

/**
 * Ops Console event intake (solen_events).
 * Product analytics only: event name, session, user id, metadata. Never care content.
 * Unknown event names are rejected so a typo cannot pollute the funnel.
 */
async function postTrackHandler(request: NextRequest, user: any) {
  try {
    const body = (await request.json()) ?? {};
    const eventName = typeof body.event_name === "string" ? body.event_name : "";
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";

    if (!isOpsEventName(eventName)) {
      return NextResponse.json({ error: "event_name is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {};

    await insertSolenEvent({
      user_id: user.id,  // Use authenticated user's ID for security
      event_name: eventName,
      session_id: sessionId,
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}



export const POST = withAuthentication(postTrackHandler);



