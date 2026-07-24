import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  generateCheckin,
  getOrCreateProfile,
  patchProfileRecord,
  tryLoadProfile,
  type CheckinPeriod,
} from "@/lib/cognitive-relief";

/** POST /api/cognitive-relief/checkin — close-the-loop ritual with explicit permission */
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
  const period = input.period;
  if (period !== "daily" && period !== "weekly") {
    return NextResponse.json({ error: "period must be daily or weekly" }, { status: 400 });
  }

  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;
  const resolvedLabels = Array.isArray(input.resolved_labels)
    ? input.resolved_labels.filter((x): x is string => typeof x === "string")
    : [];

  const record =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const checkin = generateCheckin(
    record.profile,
    period as CheckinPeriod,
    record.last_checkin_at,
    resolvedLabels,
  );

  patchProfileRecord(record.id, {
    last_checkin_at: checkin.generated_at,
    checkin_period: period as CheckinPeriod,
  });

  return NextResponse.json(checkin);
}
