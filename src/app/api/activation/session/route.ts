import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getActivationSession } from "@/lib/activation-system/server";

const DEFAULT_USER_ID = "default_caregiver";

function userIdFrom(req: NextRequest): string {
  return req.nextUrl.searchParams.get("user_id") ?? DEFAULT_USER_ID;
}

/** GET /api/activation/session */
export async function GET(req: NextRequest) {
  const userId = userIdFrom(req);
  const isReturn = req.nextUrl.searchParams.get("return_session") === "true";
  const lastSnippet = req.nextUrl.searchParams.get("last_input_snippet");
  const followUpRaw = req.nextUrl.searchParams.get("prior_follow_up_count");
  const dismissedRaw = req.nextUrl.searchParams.get("dismissed_prompt_ids");

  const dismissed =
    dismissedRaw && dismissedRaw.length > 0
      ? dismissedRaw.split(",").filter(Boolean)
      : undefined;

  const session = await getActivationSession({
    user_id: userId,
    is_return_session: isReturn,
    last_input_snippet: lastSnippet,
    prior_follow_up_count:
      followUpRaw != null && followUpRaw !== "" ? Number(followUpRaw) : null,
    dismissed_prompt_ids: dismissed,
  });

  return NextResponse.json({ session });
}
