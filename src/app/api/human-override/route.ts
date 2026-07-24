import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  HUMAN_OVERRIDE_KINDS,
  recordHumanOverride,
} from "@/lib/human-override";

const HumanOverrideBodySchema = z.object({
  situationId: z.string().min(1),
  kind: z.enum(HUMAN_OVERRIDE_KINDS),
  targetId: z.string().optional(),
  note: z.string().max(2000).optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/human-override — v1.4 stub API for caregiver overrides.
 * Records intent only; does not yet mutate STATE/BELIEF or re-rank priority.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = HumanOverrideBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid override payload" }, { status: 400 });
  }

  const result = recordHumanOverride(parsed.data);
  return NextResponse.json(result);
}
