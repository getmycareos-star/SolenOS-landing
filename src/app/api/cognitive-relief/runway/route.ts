import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_CAREGIVER_ID,
  computePoolRunway,
  getOrCreateProfile,
  patchProfileRecord,
  tryLoadProfile,
} from "@/lib/cognitive-relief";

/** GET /api/cognitive-relief/runway — soft depletion window, not budgeting */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const budgetParam = req.nextUrl.searchParams.get("budget");
  const budgetOverride = budgetParam != null ? Number(budgetParam) : undefined;

  const record =
    (await tryLoadProfile(caregiverId, null)) ??
    getOrCreateProfile({ caregiver_id: caregiverId });

  const budget =
    budgetOverride != null && Number.isFinite(budgetOverride)
      ? budgetOverride
      : record.optional_budget;

  if (budgetOverride != null && Number.isFinite(budgetOverride)) {
    patchProfileRecord(record.id, { optional_budget: budgetOverride });
  }

  const openItems = record.profile.tagged_event_log.slice(-8).map((e) => e.tag);
  const runway = computePoolRunway(record.profile, budget ?? null, openItems);

  return NextResponse.json(runway);
}
