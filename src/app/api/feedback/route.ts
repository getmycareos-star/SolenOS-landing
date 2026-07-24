import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordReliefFeedback } from "@/lib/telemetry-persistence/server";
import { TelemetryFeedbackSubmitSchema } from "@/lib/telemetry-persistence";

/**
 * POST /api/feedback — trust signal (telemetry) + optional one-turn load/containment.
 * Confusion feedback with care_key may hold Clarity / reduce asks on the next capture only.
 * Never changes response wording or shows scores.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = TelemetryFeedbackSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback payload" },
      { status: 400 },
    );
  }

  try {
    await recordReliefFeedback(parsed.data);
  } catch (error) {
    console.warn("[/api/feedback] telemetry write failed:", error);
    return NextResponse.json({ error: "Telemetry store unavailable" }, { status: 503 });
  }

  return NextResponse.json({ stored: true, interaction_id: parsed.data.interaction_id });
}
