import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  AUDIT_TRAIL_IDENTITY,
  getAuditLogForRecipient,
  processAuditTrail,
  replayCareContextAt,
} from "@/lib/audit-trail-system";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/audit-trail — immutable change log and replay metadata */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const context = getCareContextRoot(caregiverId);
  const careRecipientId = context?.care_recipient_id ?? "default_care_recipient";
  const asOf = req.nextUrl.searchParams.get("as_of") ?? new Date().toISOString();

  const layer = processAuditTrail({
    care_recipient_id: careRecipientId,
    events_created_count: 0,
  });

  const replay = replayCareContextAt(careRecipientId, asOf);

  return NextResponse.json({
    identity: AUDIT_TRAIL_IDENTITY,
    audit_trail_layer: layer,
    entries: getAuditLogForRecipient(careRecipientId).slice(-20),
    replay_entity_count: replay.entity_states.size,
  });
}
