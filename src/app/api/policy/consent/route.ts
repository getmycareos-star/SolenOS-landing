import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DATA_IMPROVEMENT_CONSENT_STATEMENT,
  getConsentManagerStatus,
  NO_ADVERTISING_CONSENT_STATEMENT,
  ONE_LINE_USER_AGREEMENT,
  POLICY_ENGINE_IDENTITY,
  recordConsentAcceptance,
  revokeConsent,
  SIGNUP_IMPROVEMENT_COPY,
  TERMS_OF_SERVICE_VERSION,
  updateDataImprovementConsent,
} from "@/lib/policy-engine";

const DEFAULT_USER_ID = "default_caregiver";

/** GET /api/policy/consent — consent status for caregiver */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id") ?? DEFAULT_USER_ID;
  const status = getConsentManagerStatus(userId);

  return NextResponse.json({
    identity: POLICY_ENGINE_IDENTITY,
    user_id: userId,
    ...status,
    signup_improvement_copy: SIGNUP_IMPROVEMENT_COPY,
  });
}

/** POST /api/policy/consent — accept or update consent */
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

  const record = body as Record<string, unknown>;
  const userId =
    typeof record.user_id === "string" ? record.user_id : DEFAULT_USER_ID;

  if (record.action === "revoke") {
    const revoked = revokeConsent(userId);
    return NextResponse.json({
      identity: POLICY_ENGINE_IDENTITY,
      user_id: userId,
      profile: revoked,
      limited_mode: true,
    });
  }

  if (record.action === "update_data_improvement") {
    const enabled = record.data_improvement_consent === true;
    const updated = updateDataImprovementConsent(userId, enabled);
    if (!updated) {
      return NextResponse.json(
        { error: "Consent profile not found or limited mode active." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      identity: POLICY_ENGINE_IDENTITY,
      user_id: userId,
      profile: updated,
    });
  }

  const profile = recordConsentAcceptance({
    user_id: userId,
    accepted_terms_version:
      typeof record.accepted_terms_version === "string"
        ? record.accepted_terms_version
        : TERMS_OF_SERVICE_VERSION,
    medical_disclaimer_acknowledged: record.medical_disclaimer_acknowledged === true,
    privacy_model_acknowledged: record.privacy_model_acknowledged === true,
    multi_caregiver_acknowledged: record.multi_caregiver_acknowledged === true,
    data_improvement_consent: record.data_improvement_consent === true,
    no_advertising_acknowledged: record.no_advertising_acknowledged === true,
  });

  return NextResponse.json({
    identity: POLICY_ENGINE_IDENTITY,
    user_id: userId,
    profile,
    one_line_agreement: ONE_LINE_USER_AGREEMENT,
    data_improvement_statement: DATA_IMPROVEMENT_CONSENT_STATEMENT,
    no_advertising_statement: NO_ADVERTISING_CONSENT_STATEMENT,
    verified: true,
  });
}
