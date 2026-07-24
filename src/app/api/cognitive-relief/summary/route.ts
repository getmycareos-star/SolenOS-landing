import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  generateSummary,
  getOrCreateProfile,
  tryLoadProfile,
  type SummaryAudience,
} from "@/lib/cognitive-relief";

const AUDIENCES = new Set(["new_doctor", "family_member", "aide", "custom"]);

/** POST /api/cognitive-relief/summary — audience-specific slice, not a data dump */
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
  const audience = input.audience;
  if (typeof audience !== "string" || !AUDIENCES.has(audience)) {
    return NextResponse.json(
      { error: "audience must be new_doctor, family_member, aide, or custom" },
      { status: 400 },
    );
  }

  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;
  const scope = typeof input.scope === "string" ? input.scope : "current";

  const record =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const summary = generateSummary(
    record.profile,
    audience as SummaryAudience,
    scope,
  );

  return NextResponse.json(summary);
}
