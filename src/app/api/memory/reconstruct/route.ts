import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  reconstructMemory,
  toMemoryReconstructionLayerPayload,
} from "@/lib/memory-reconstruction-engine";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** POST /api/memory/reconstruct — temporal memory reconstruction from Care Journey */
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
  const query = input.query;

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const result = reconstructMemory({
    query: query.trim(),
    caregiver_id:
      typeof input.caregiver_id === "string" ? input.caregiver_id : DEFAULT_CAREGIVER_ID,
    case_id: typeof input.case_id === "string" ? input.case_id : null,
  });

  return NextResponse.json({
    result,
    layer: toMemoryReconstructionLayerPayload(result),
  });
}
