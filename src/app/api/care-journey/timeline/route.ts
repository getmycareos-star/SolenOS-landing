import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CARE_JOURNEY_CATEGORIES,
  type CareJourneyCategory,
} from "@/lib/care-journey";
import {
  loadCareJourneyTimeline,
  recordCareJourneyEvent,
  searchCareJourney,
} from "@/lib/care-journey/server";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/care-journey/timeline */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const query = req.nextUrl.searchParams.get("q");

  if (query?.trim()) {
    const result = await searchCareJourney(caregiverId, query);
    return NextResponse.json(result);
  }

  const timeline = await loadCareJourneyTimeline(caregiverId);
  return NextResponse.json({ timeline, total: timeline.length });
}

/** POST /api/care-journey/events */
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
  const description = input.description;

  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const category = input.category;
  if (
    category !== undefined &&
    (typeof category !== "string" ||
      !CARE_JOURNEY_CATEGORIES.includes(category as CareJourneyCategory))
  ) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const event = await recordCareJourneyEvent({
    description: description.trim(),
    caregiver_id:
      typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID,
    case_id: typeof input.case_id === "string" ? input.case_id : null,
    category: category as CareJourneyCategory | undefined,
    title: typeof input.title === "string" ? input.title : undefined,
    event_date: typeof input.event_date === "string" ? input.event_date : undefined,
    source: typeof input.source === "string" ? input.source : undefined,
    attachments: Array.isArray(input.attachments) ? input.attachments : undefined,
    metadata:
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : undefined,
  });

  return NextResponse.json({ event });
}
