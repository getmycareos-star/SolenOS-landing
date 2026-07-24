import { NextResponse } from "next/server";
import { recordUnderstandingFeedback } from "@/lib/research-feedback";

export const runtime = "nodejs";

/**
 * POST /api/research-feedback — store understanding Yes/No (+ No details).
 * Durable product research — never discard. Not engagement chrome.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const data = body as {
    care_key?: string;
    helped_understand?: boolean;
    missed?: string;
    expected_understanding?: string;
    confusing?: string;
    expected_notice?: string;
    situation_id?: string;
    raw_input_excerpt?: string;
  };

  if (!data.care_key?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_care_key" }, { status: 400 });
  }
  if (typeof data.helped_understand !== "boolean") {
    return NextResponse.json({ ok: false, error: "missing_helped_understand" }, { status: 400 });
  }

  try {
    const entry = recordUnderstandingFeedback({
      careKey: data.care_key.trim(),
      helpedUnderstand: data.helped_understand,
      missed: data.missed,
      expectedUnderstanding: data.expected_understanding,
      confusing: data.confusing,
      expectedNotice: data.expected_notice,
      situationId: data.situation_id,
      rawInputExcerpt: data.raw_input_excerpt,
    });
    return NextResponse.json({ ok: true, id: entry.id, stored: true });
  } catch (error) {
    console.warn("[/api/research-feedback] store failed:", error);
    return NextResponse.json({ ok: false, error: "store_unavailable" }, { status: 503 });
  }
}
