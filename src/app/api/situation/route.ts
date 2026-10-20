import { NextResponse } from "next/server";
import type { ProcessSituationInput, SituationResponse } from "@/lib/situation-entry";
import {
  processSituationInput,
  processSessionReentry,
  getCareContextRoot,
  getOrCreateCareContextRoot,
} from "@/lib/situation-entry";
import { getActiveCareSituation } from "@/lib/active-care-situation";
import { getCareRealityState } from "@/lib/care-reality-state";
import { buildReturnContinuityProjection } from "@/lib/return-continuity";
import { upsertTrackedSituationFromCareInput, trackedSituationToUiSituation } from "@/lib/resolution-engine/care-context-sync";
import { toActiveSituation } from "@/lib/ui-runtime/situation-store";
import { openSituationsFromSituationApi } from "@/lib/ui-runtime/open-situations";

export const runtime = "nodejs";

function resolveCaregiverId(input: { caregiver_id?: string; care_session_id?: string }): string {
  return input.caregiver_id ?? input.care_session_id ?? "default_caregiver";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const caregiverId = resolveCaregiverId({
    caregiver_id: url.searchParams.get("caregiver_id") ?? undefined,
    care_session_id: url.searchParams.get("care_session_id") ?? undefined,
  });
  const offerReturnInvite = url.searchParams.get("offer_return_invite") === "1";

  const context = getCareContextRoot(caregiverId);
  const hasContextRoot = Boolean(context && context.events.length > 0);

  const acs = getActiveCareSituation(caregiverId);
  const crs = getCareRealityState(caregiverId);

  let returnContinuity = null;
  if (offerReturnInvite) {
    returnContinuity = buildReturnContinuityProjection({
      careKey: caregiverId,
      acs,
      crs,
      offerSoftInvite: true,
    });
  }

  const trackedSync = upsertTrackedSituationFromCareInput({
    durableCareKey: caregiverId,
    rawInput: "",
    eventIds: [],
    documentIds: [],
    userId: caregiverId,
    opensNewSituation: false,
  });

  const uiSituations = trackedSync.ui_situations.filter((s) => s.status !== "resolved");
  const situations = trackedSync.situations;

  const response: Record<string, unknown> = {
    has_context_root: hasContextRoot,
    care_key: caregiverId,
    care_recipient_id: context?.care_recipient_id ?? caregiverId,
    care_recipient_display_name: crs?.care_recipient_label ?? null,
    context,
    active_care_situation: acs ?? null,
    active_care_situation_turn: acs ? { situation: acs } : null,
    ui_situations: uiSituations,
    situations,
    return_continuity: returnContinuity,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawInput = typeof body.raw_input === "string" ? body.raw_input.trim() : "";
    const caregiverId = resolveCaregiverId({
      caregiver_id: typeof body.caregiver_id === "string" ? body.caregiver_id : undefined,
      care_session_id: typeof body.care_session_id === "string" ? body.care_session_id : undefined,
    });

    if (!rawInput && (!Array.isArray(body.documents) || body.documents.length === 0)) {
      return NextResponse.json(
        { error: "missing_input", note: "Provide raw_input or at least one document." },
        { status: 400 },
      );
    }

    const documents = Array.isArray(body.documents)
      ? body.documents.filter(
          (d: unknown) =>
            typeof d === "object" &&
            d !== null &&
            typeof (d as { id?: unknown }).id === "string" &&
            typeof (d as { extracted_text?: unknown }).extracted_text === "string",
        )
      : [];

    const input: ProcessSituationInput = {
      raw_input: rawInput,
      caregiver_id: caregiverId,
      care_session_id: typeof body.care_session_id === "string" ? body.care_session_id : undefined,
      contributor_id: typeof body.contributor_id === "string" ? body.contributor_id : caregiverId,
      care_recipient_id: typeof body.care_recipient_id === "string" ? body.care_recipient_id : caregiverId,
      source: "user_input",
      timestamp: typeof body.captured_at === "string" ? body.captured_at : undefined,
      provenance: body.provenance,
      documents: documents.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        name: (d.name ?? d.id) as string,
        extracted_text: d.extracted_text as string,
        mime_type: (d.mime_type ?? null) as string | null,
        ocr_confidence: (d.ocr_confidence ?? null) as number | null,
        extraction_source: (d.extraction_source ?? null) as string | null,
      })),
    };

    const result = await processSituationInput(input);

    const trackedSync = upsertTrackedSituationFromCareInput({
      durableCareKey: caregiverId,
      rawInput: rawInput,
      eventIds: result.events_created.map((e) => e.id),
      documentIds: documents.map((d: { id: string }) => d.id),
      userId: caregiverId,
      opensNewSituation: result.active_care_situation_turn?.relation === "opens_new",
    });

    const payload: Record<string, unknown> = {
      ...result,
      care_key: caregiverId,
      care_session_id: body.care_session_id ?? caregiverId,
      ui_situations: trackedSync.ui_situations.filter((s) => s.status !== "resolved"),
      situations: trackedSync.situations,
      care_situation_groups: result.care_situation_groups,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/situation] POST failed:", error);
    return NextResponse.json(
      {
        error: "situation_pipeline_failed",
        note: error instanceof Error ? error.message : "Unexpected error processing situation input.",
      },
      { status: 500 },
    );
  }
}
