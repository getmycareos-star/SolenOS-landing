import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  getOrCreateCaregiverSelfProfile,
  processCapacitySelfSession,
  setCaregiverCapacity,
  type CapacityLevel,
  type ContextType,
} from "@/lib/capacity-self";

/** GET /api/capacity-self/session — batch view + capacity suggestion + items */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const input = req.nextUrl.searchParams.get("input") ?? undefined;
  const activeContext = req.nextUrl.searchParams.get("active_context") as ContextType | null;
  const includeReflection = req.nextUrl.searchParams.get("reflection") === "1";

  const session = await processCapacitySelfSession({
    caregiver_id: caregiverId,
    input,
    active_context: activeContext,
    include_reflection: includeReflection,
  });

  const selfProfile = getOrCreateCaregiverSelfProfile(caregiverId);

  return NextResponse.json({
    ...session,
    session_capacity: selfProfile.session_capacity,
  });
}

/** POST /api/capacity-self/session/capacity — one-tap capacity input */
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
  const capacity = input.capacity;
  if (capacity !== "low" && capacity !== "medium" && capacity !== "high") {
    return NextResponse.json({ error: "capacity must be low, medium, or high" }, { status: 400 });
  }

  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;

  await setCaregiverCapacity(caregiverId, capacity as CapacityLevel);

  const session = await processCapacitySelfSession({
    caregiver_id: caregiverId,
    input: typeof input.input === "string" ? input.input : undefined,
    active_context:
      typeof input.active_context === "string"
        ? (input.active_context as ContextType)
        : null,
  });

  return NextResponse.json({
    capacity: capacity as CapacityLevel,
    ...session,
  });
}
