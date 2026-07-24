import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveSharedView } from "@/lib/cognitive-relief";

type RouteContext = { params: Promise<{ token: string }> };

/** GET /api/cognitive-relief/share/[token] — no account required for recipient */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const view = resolveSharedView(token);

  if (!view) {
    return NextResponse.json({ error: "Link expired or not found" }, { status: 404 });
  }

  return NextResponse.json(view);
}
