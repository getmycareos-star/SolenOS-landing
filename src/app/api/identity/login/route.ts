import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  IdentityLoginRequestSchema,
  authenticatePersistentUser,
  bindSessionToUser,
  rehydrateCareState,
} from "@/lib/identity-continuity";
import { CONTINUITY_RESPONSE_HEADERS } from "@/lib/identity-continuity/contract-constants";
import { TELEMETRY_RESPONSE_HEADERS } from "@/lib/telemetry-persistence/schema";

/**
 * POST /api/identity/login — restore care graph state (NOT auth gate).
 * Performs ONLY: restoreCareGraph, hydrateMemoryState, resumeContinuityState, rebindActiveDecisions.
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
    request = IdentityLoginRequestSchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Invalid request: email and password required" },
      { status: 400 },
    );
  }

  const auth = await authenticatePersistentUser({
    email: request.email,
    password: request.password,
  });

  if (!auth) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (request.care_session_id) {
    bindSessionToUser(request.care_session_id, auth.user_id);
  }

  const rehydrated = rehydrateCareState(auth.user_id);
  if (!rehydrated) {
    return NextResponse.json(
      { error: "No stored care graph to restore" },
      { status: 404 },
    );
  }

  const headers = new Headers();
  headers.set(TELEMETRY_RESPONSE_HEADERS.userId, auth.user_id);
  headers.set(CONTINUITY_RESPONSE_HEADERS.sessionId, rehydrated.continuity_state.care_session_id);

  return NextResponse.json(
    {
      user_id: auth.user_id,
      care_session_id: rehydrated.continuity_state.care_session_id,
      care_graph: rehydrated.care_graph,
      memory_nodes: rehydrated.memory_nodes,
      active_decisions: rehydrated.active_decisions,
      identity_state: {
        mode: rehydrated.continuity_state.mode,
        auth_enabled: rehydrated.continuity_state.auth_enabled,
        has_stored_care_graph: rehydrated.continuity_state.has_stored_care_graph,
      },
    },
    { headers },
  );
}
