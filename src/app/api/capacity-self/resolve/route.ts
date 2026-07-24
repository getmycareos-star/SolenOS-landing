import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  resolveCareItem,
  classifyContextType,
  type ItemSubject,
} from "@/lib/capacity-self";

/** POST /api/capacity-self/resolve — mark item resolved for factual record */
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

  const subject = input.subject;
  if (subject !== "caregiver" && subject !== "care_recipient") {
    return NextResponse.json({ error: "subject must be caregiver or care_recipient" }, { status: 400 });
  }

  const caregiverId =
    typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID;

  const resolved = await resolveCareItem({
    caregiver_id: caregiverId,
    description: description.trim(),
    subject: subject as ItemSubject,
    context_type:
      typeof input.context_type === "string"
        ? (input.context_type as ReturnType<typeof classifyContextType>)
        : classifyContextType(description),
    raw_entry_id: typeof input.raw_entry_id === "string" ? input.raw_entry_id : null,
  });

  return NextResponse.json({ resolved });
}
