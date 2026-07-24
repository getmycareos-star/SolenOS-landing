import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  generateSharedView,
  getOrCreateProfile,
  tryLoadProfile,
} from "@/lib/cognitive-relief";

/** POST /api/cognitive-relief/share — narrow token-based read-only view */
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
  const recipientLabel = input.recipient_label;
  if (typeof recipientLabel !== "string" || !recipientLabel.trim()) {
    return NextResponse.json({ error: "recipient_label required" }, { status: 400 });
  }

  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;
  const scope =
    input.scope && typeof input.scope === "object" && !Array.isArray(input.scope)
      ? (input.scope as Record<string, unknown>)
      : { window: "this_week" };
  const includedFields = Array.isArray(input.included_fields)
    ? input.included_fields.filter((x): x is string => typeof x === "string")
    : undefined;

  const record =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const shared = generateSharedView(
    record.id,
    record.profile,
    recipientLabel.trim(),
    scope,
    includedFields,
  );

  return NextResponse.json(shared);
}
