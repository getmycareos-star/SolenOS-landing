import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  getOrCreateProfile,
  tryLoadProfile,
  updateProfileData,
  upsertLocation,
  type CareRecipientProfileData,
} from "@/lib/cognitive-relief";

function caregiverIdFrom(req: NextRequest, body?: Record<string, unknown>): string {
  const fromQuery = req.nextUrl.searchParams.get("caregiver_id");
  if (fromQuery) return fromQuery;
  if (body && typeof body.caregiver_id === "string") return body.caregiver_id;
  return DEFAULT_CAREGIVER_ID;
}

/** GET /api/cognitive-relief/profile */
export async function GET(req: NextRequest) {
  const caregiverId = caregiverIdFrom(req);
  const record =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  return NextResponse.json({ profile: record });
}

/** PATCH /api/cognitive-relief/profile — caregiver corrections only */
export async function PATCH(req: NextRequest) {
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
  const caregiverId = caregiverIdFrom(req, record);
  const existing =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const profilePatch = record.profile;
  if (!profilePatch || typeof profilePatch !== "object") {
    return NextResponse.json({ error: "profile object required" }, { status: 400 });
  }

  const updated = updateProfileData(existing.id, (current) => ({
    ...current,
    ...(profilePatch as Partial<CareRecipientProfileData>),
  }));

  return NextResponse.json({ profile: updated });
}

/** POST /api/cognitive-relief/profile/locations — upsert location pointer */
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
  const label = input.label;
  const location = input.physical_or_digital_location;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }
  if (typeof location !== "string" || !location.trim()) {
    return NextResponse.json({ error: "physical_or_digital_location required" }, { status: 400 });
  }

  const caregiverId = caregiverIdFrom(req, input);
  const existing =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const updated = updateProfileData(existing.id, (profile) => ({
    ...profile,
    location_index: upsertLocation(profile.location_index, {
      label: label.trim(),
      physical_or_digital_location: location.trim(),
    }),
  }));

  return NextResponse.json({
    location_index: updated?.profile.location_index ?? [],
  });
}
