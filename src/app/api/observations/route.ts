import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordObservation } from "@/lib/observation-intelligence";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/**
 * POST /api/observations — record caregiver observation, return structured + aggregation.
 */
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

  const { raw_text, caregiver_id, source } = body as {
    raw_text?: unknown;
    caregiver_id?: unknown;
    source?: unknown;
  };

  if (typeof raw_text !== "string" || !raw_text.trim()) {
    return NextResponse.json(
      { error: "raw_text must be a non-empty string" },
      { status: 400 },
    );
  }

  if (caregiver_id !== undefined && typeof caregiver_id !== "string") {
    return NextResponse.json({ error: "caregiver_id must be a string" }, { status: 400 });
  }

  if (source !== undefined && source !== "text" && source !== "voice") {
    return NextResponse.json({ error: "source must be text or voice" }, { status: 400 });
  }

  const result = recordObservation({
    raw_text: raw_text.trim(),
    caregiver_id: typeof caregiver_id === "string" ? caregiver_id : DEFAULT_CAREGIVER_ID,
    source: source === "voice" ? "voice" : "text",
  });

  return NextResponse.json(result);
}
