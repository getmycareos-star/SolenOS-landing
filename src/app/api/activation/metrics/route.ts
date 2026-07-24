import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getDashboardActivationMetrics,
  getUserActivationMetrics,
} from "@/lib/activation-system/server";

const DEFAULT_USER_ID = "default_caregiver";

/** GET /api/activation/metrics?user_id=... or ?scope=dashboard */
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");

  if (scope === "dashboard") {
    const dashboard = await getDashboardActivationMetrics();
    return NextResponse.json({ dashboard });
  }

  const userId = req.nextUrl.searchParams.get("user_id") ?? DEFAULT_USER_ID;
  const user = await getUserActivationMetrics(userId);
  return NextResponse.json({ user });
}
