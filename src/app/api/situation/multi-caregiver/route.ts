import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  MULTI_CAREGIVER_CONTEXT_IDENTITY,
  getRecipientContext,
  processMultiCaregiverContext,
  resolveCareRecipientId,
} from "@/lib/multi-caregiver-context-model";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/multi-caregiver — shared care recipient context and attribution */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);
  const careRecipientId =
    req.nextUrl.searchParams.get("care_recipient_id") ?? resolveCareRecipientId(caregiverId);

  const layer = processMultiCaregiverContext({
    caregiver_id: caregiverId,
    care_recipient_id: careRecipientId,
    events_created: context?.events.slice(-3) ?? [],
    all_events: context?.events ?? [],
  });

  return NextResponse.json({
    identity: MULTI_CAREGIVER_CONTEXT_IDENTITY,
    multi_caregiver_context_layer: layer,
    recipient_context: getRecipientContext(careRecipientId),
  });
}
