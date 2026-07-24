import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ACTIVATION_EVENT_TYPES, type ActivationEventType } from "@/lib/activation-system";
import { trackActivationEvent } from "@/lib/activation-system/server";

const DEFAULT_USER_ID = "default_caregiver";

function userIdFrom(req: NextRequest, body?: Record<string, unknown>): string {
  const fromQuery = req.nextUrl.searchParams.get("user_id");
  if (fromQuery) return fromQuery;
  if (body && typeof body.user_id === "string") return body.user_id;
  return DEFAULT_USER_ID;
}

/** POST /api/activation/events */
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
  const userId = userIdFrom(req, input);
  const eventType = input.event_type;

  if (
    typeof eventType !== "string" ||
    !ACTIVATION_EVENT_TYPES.includes(eventType as ActivationEventType)
  ) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const result = await trackActivationEvent({
    user_id: userId,
    event_type: eventType as ActivationEventType,
    payload:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : {},
    created_at: typeof input.created_at === "string" ? input.created_at : undefined,
  });

  return NextResponse.json({
    event: result.event,
    state: result.state,
  });
}
