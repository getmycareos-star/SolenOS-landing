import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  IdentitySignupRequestSchema,
  upgradeEphemeralToPersistent,
} from "@/lib/identity-continuity";
import { CONTINUITY_RESPONSE_HEADERS } from "@/lib/identity-continuity/contract-constants";
import { TELEMETRY_RESPONSE_HEADERS } from "@/lib/telemetry-persistence/schema";

/**
 * POST /api/identity/signup — bind ephemeral care state to persistent identity.
 * Does NOT reset care graph, memory, or active decisions.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let request;
  try {
    request = IdentitySignupRequestSchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Invalid request: care_session_id, email, and password required" },
      { status: 400 },
    );
  }

  try {
    const upgraded = await upgradeEphemeralToPersistent({
      care_session_id: request.care_session_id,
      email: request.email,
      password: request.password,
      telemetry_user_id: request.telemetry_user_id,
    });

    const headers = new Headers();
    headers.set(TELEMETRY_RESPONSE_HEADERS.userId, upgraded.user_id);
    headers.set(CONTINUITY_RESPONSE_HEADERS.sessionId, upgraded.care_session_id);

    const { emitOpsEventServer } = await import("@/lib/ops-console/emit-server");
    emitOpsEventServer({
      event_name: "signup_completed",
      user_id: upgraded.user_id,
      session_id: upgraded.care_session_id,
      metadata: { user_id: upgraded.user_id, method: "email" },
    });

    return NextResponse.json(
      {
        user_id: upgraded.user_id,
        care_session_id: upgraded.care_session_id,
        identity_state: {
          mode: upgraded.identity_state.mode,
          auth_enabled: upgraded.identity_state.auth_enabled,
          has_stored_care_graph: upgraded.identity_state.has_stored_care_graph,
        },
      },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
