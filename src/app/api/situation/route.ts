import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  SITUATION_ENTRY_IDENTITY,
  getCareContextRoot,
  getSituationTimeline,
  processSituationInput,
} from "@/lib/situation-entry";
import {
  FINAL_OUTPUT_CONTRACT_IDENTITY,
  validateFinalOutput,
} from "@/lib/final-output-contract";
import { requireCareKeyFromRequest, resolveInteractionSessionId } from "@/lib/care-identity";
import {
  hydrateTrackedSituationsFromCareContext,
  listActiveUiSituationsForCareKey,
  trackedSituationToUiSituation,
} from "@/lib/resolution-engine/care-context-sync";
import { toActiveSituation } from "@/lib/ui-runtime/situation-store";
import {
  getActiveCareSituation,
  groupEventsBySituationId,
  pauseActiveCareSituationSession,
  projectActiveSituationTurn,
} from "@/lib/active-care-situation";
import {
  getCareRecipientDisplayName,
  setCareRecipientDisplayName,
} from "@/lib/care-recipient-identity";
import { getCareRealityState } from "@/lib/care-reality-state";
import {
  buildReturnContinuityProjection,
  markInteractionPaused,
  markInteractionTouched,
} from "@/lib/return-continuity";
import { ensureContributorCareReality } from "@/lib/multi-caregiver-context-model";
/** POST /api/situation — single entry point: Add Situation (+ ACS pause) */
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

  const keyResult = requireCareKeyFromRequest({
    caregiver_id: typeof record.caregiver_id === "string" ? record.caregiver_id : null,
    care_session_id: typeof record.care_session_id === "string" ? record.care_session_id : null,
  });
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 400 });
  }
  const caregiverId = keyResult.careKey;
  const careSessionId = resolveInteractionSessionId(
    typeof record.care_session_id === "string" ? record.care_session_id : null,
  );
  const joinCareRecipientId =
    typeof record.care_recipient_id === "string" ? record.care_recipient_id.trim() : null;
  const contributorId =
    typeof record.contributor_id === "string" && record.contributor_id.trim()
      ? record.contributor_id.trim()
      : caregiverId;
  const careRecipientId = ensureContributorCareReality(
    contributorId,
    joinCareRecipientId,
  );

  // Ask-once care recipient display name (MVP identity naming).
  // Identity lives on the Care Reality (care recipient), not the contributor session.
  if (record.action === "set_care_recipient_display_name") {
    const name =
      typeof record.display_name === "string" ? record.display_name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }
    try {
      const identity = setCareRecipientDisplayName({
        careKey: careRecipientId,
        displayName: name,
        relationship:
          typeof record.relationship === "string" ? record.relationship : null,
      });
      return NextResponse.json({
        ok: true,
        care_key: caregiverId,
        care_recipient_id: careRecipientId,
        care_session_id: careSessionId,
        care_recipient_display_name: identity.display_name,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save name" },
        { status: 400 },
      );
    }
  }

  // Done for now — pause interaction session only.
  // ACS + CRS persist (solenos-done-for-now-continuity). Do not resolve care reality.
  if (record.action === "pause_active_care_situation") {
    const paused = pauseActiveCareSituationSession(caregiverId);
    markInteractionPaused(caregiverId);
    const uiSituations = listActiveUiSituationsForCareKey(careRecipientId);
    // TrackedSituation sidebar stays — engine owns lifecycle, not the Done button.
    const return_continuity = buildReturnContinuityProjection({
      careKey: caregiverId,
      acs: paused,
      crs: getCareRealityState(caregiverId),
      // Soft invite is for true return; pause response still signals durable reality.
      offerSoftInvite: false,
    });
    return NextResponse.json({
      ok: true,
      care_key: caregiverId,
      care_session_id: careSessionId,
      interaction_paused: true,
      active_care_situation: paused,
      active_care_situation_turn: paused
        ? projectActiveSituationTurn(paused, "updates_active")
        : null,
      active_situations: uiSituations.map((s) => toActiveSituation(s)),
      ui_situations: uiSituations,
      situations: uiSituations,
      return_continuity,
      has_context_root: Boolean(
        (paused?.observations.length ?? 0) > 0 ||
          getCareContextRoot(caregiverId)?.events.length,
      ),
    });
  }

  const rawInput = record.raw_input ?? record.content;
  const documents = Array.isArray(record.documents)
    ? (
        record.documents as {
          id: string;
          name: string;
          extracted_text: string;
          mime_type?: string | null;
          ocr_confidence?: number | null;
        }[]
      ).filter((d) => d?.id && d?.extracted_text?.trim())
    : undefined;

  const rawInputStr = typeof rawInput === "string" ? rawInput.trim() : "";
  const hasDocText = (documents?.length ?? 0) > 0;

  // Empty body with no documents → session reentry (continuity hydrate).
  if (!rawInputStr && !hasDocText) {
    const { processSessionReentry } = await import("@/lib/situation-entry/pipeline");
    const result = await processSessionReentry({
      caregiver_id: caregiverId,
      raw_input: "",
      timestamp:
        typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString(),
    });
    validateFinalOutput(result.final_output);
    const hydrated = hydrateFromContext(caregiverId, joinCareRecipientId);
    const { toCaregiverSituationResponse } = await import(
      "@/lib/situation-entry/caregiver-response-dto"
    );
    const caregiverBody = toCaregiverSituationResponse(result);
    return NextResponse.json({
      identity: FINAL_OUTPUT_CONTRACT_IDENTITY,
      situation_identity: SITUATION_ENTRY_IDENTITY,
      ...caregiverBody,
      ...hydrated,
      care_key: caregiverId,
      care_session_id: careSessionId,
    });
  }

  // Document-only is valid: raw_input may be "" when documents[] carry extracted_text.
  const provenance =
    record.provenance && typeof record.provenance === "object"
      ? (record.provenance as {
          input_type?: "voice" | "text" | "document";
          entry_method?: "scan" | "snap" | "upload" | "share" | "text" | "voice";
          captured_at?: string;
          recognition_confidence?: number | null;
          transcript_uncertain?: boolean;
        })
      : undefined;

  const result = await processSituationInput({
    raw_input: rawInputStr,
    caregiver_id: caregiverId,
    contributor_id: contributorId,
    care_recipient_id: careRecipientId,
    care_session_id: careSessionId,
    timestamp:
      typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString(),
    provenance: provenance?.input_type
      ? {
          input_type: provenance.input_type,
          entry_method: provenance.entry_method,
          captured_at: provenance.captured_at,
          recognition_confidence: provenance.recognition_confidence ?? null,
          transcript_uncertain: provenance.transcript_uncertain ?? false,
        }
      : hasDocText
        ? {
            input_type: "document" as const,
            entry_method: provenance?.entry_method,
            captured_at:
              typeof record.captured_at === "string"
                ? record.captured_at
                : new Date().toISOString(),
          }
        : typeof record.captured_at === "string"
          ? { input_type: "text" as const, captured_at: record.captured_at }
          : undefined,
    documents,
  });

  validateFinalOutput(result.final_output);

  const { emitOpsEventServer } = await import("@/lib/ops-console/emit-server");
  emitOpsEventServer({
    event_name: "input_submitted",
    user_id: caregiverId,
    session_id:
      typeof record.session_id === "string" ? record.session_id : careSessionId,
    metadata: {
      input_type: provenance?.input_type ?? (hasDocText ? "photo" : "text"),
      case_id: result.context?.id ?? null,
      has_documents: hasDocText,
      care_key: caregiverId,
    },
  });
  if (hasDocText) {
    emitOpsEventServer({
      event_name: "document_uploaded",
      user_id: caregiverId,
      session_id:
        typeof record.session_id === "string" ? record.session_id : careSessionId,
      metadata: {
        doc_type: "care_document",
        case_id: result.context?.id ?? null,
        count: documents?.length ?? 0,
        care_key: caregiverId,
      },
    });
  }

  markInteractionTouched(caregiverId);

  // Caregiver JSON — Input Reality: care reality only; engine dumps stay ops-only.
  const { toCaregiverSituationResponse } = await import(
    "@/lib/situation-entry/caregiver-response-dto"
  );
  const caregiverBody = toCaregiverSituationResponse(result);

  return NextResponse.json({
    identity: FINAL_OUTPUT_CONTRACT_IDENTITY,
    situation_identity: SITUATION_ENTRY_IDENTITY,
    care_session_id: careSessionId,
    care_recipient_id: careRecipientId,
    care_recipient_display_name: getCareRecipientDisplayName(careRecipientId),
    ...caregiverBody,
    // Alias for clients that still read `situations`
    situations: caregiverBody.ui_situations,
  });
}

function hydrateFromContext(caregiverId: string, joinCareRecipientId?: string | null) {
  const careRecipientId = ensureContributorCareReality(
    caregiverId,
    joinCareRecipientId,
  );
  const context = getCareContextRoot(caregiverId);
  const sync = hydrateTrackedSituationsFromCareContext({
    durableCareKey: careRecipientId,
    events: context?.events ?? [],
    userId: caregiverId,
  });
  const uiSituations = listActiveUiSituationsForCareKey(careRecipientId);
  const activeCareSituation = getActiveCareSituation(caregiverId);
  const care_situation_groups = groupEventsBySituationId(context?.events ?? []).map(
    ({ situation_id, root_event_id, event_ids }) => ({
      situation_id,
      root_event_id,
      event_ids,
    }),
  );
  return {
    care_key: caregiverId,
    care_recipient_id: careRecipientId,
    care_recipient_display_name: getCareRecipientDisplayName(careRecipientId),
    resolution_engine_layer: sync.resolution_engine_layer,
    active_situations: sync.active.map((t) => toActiveSituation(trackedSituationToUiSituation(t))),
    situations: uiSituations,
    tracked_situations: sync.situations,
    active_care_situation: activeCareSituation,
    active_care_situation_turn: activeCareSituation
      ? projectActiveSituationTurn(activeCareSituation)
      : null,
    care_situation_groups,
  };
}

/** GET /api/situation — CareContextRoot + TrackedSituation + Active Care Situation */
export async function GET(req: NextRequest) {
  const keyResult = requireCareKeyFromRequest({
    caregiver_id: req.nextUrl.searchParams.get("caregiver_id"),
    care_session_id: req.nextUrl.searchParams.get("care_session_id"),
  });
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 400 });
  }
  const caregiverId = keyResult.careKey;
  const joinCareRecipientId = req.nextUrl.searchParams.get("care_recipient_id");
  const careSessionId = resolveInteractionSessionId(
    req.nextUrl.searchParams.get("care_session_id"),
  );

  const context = getCareContextRoot(caregiverId);
  const timelines = getSituationTimeline(caregiverId);
  const hydrated = hydrateFromContext(caregiverId, joinCareRecipientId);
  const crs = getCareRealityState(caregiverId);
  const offerSoftInvite = req.nextUrl.searchParams.get("offer_return_invite") !== "0";
  const return_continuity = buildReturnContinuityProjection({
    careKey: caregiverId,
    acs: hydrated.active_care_situation,
    crs,
    offerSoftInvite,
  });

  return NextResponse.json({
    identity: SITUATION_ENTRY_IDENTITY,
    context: context ?? null,
    timeline: timelines.top_events,
    temporal_timeline: timelines.temporal_timeline,
    ingestion_timeline: timelines.ingestion_timeline,
    timeline_views: timelines.timeline_views,
    top_events: timelines.top_events,
    attention_events: timelines.attention_events,
    has_context_root: Boolean(context && context.events.length > 0),
    total_events: context?.events.length ?? 0,
    ...hydrated,
    return_continuity,
    care_key: caregiverId,
    care_session_id: careSessionId,
  });
}
