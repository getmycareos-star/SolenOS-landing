import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DEFAULT_CAREGIVER_ID } from "@/lib/cognitive-relief";
import { CARE_CONTEXT_TYPES, type CareContextType } from "@/lib/care-contexts";
import {
  validateDementiaStage,
  validateDrivingStatus,
  validateMedicationRisk,
  validateSundowningWindow,
} from "@/lib/care-contexts/dementia";
import {
  addFinancialRiskEvent,
  addWanderingEvent,
  getDementiaProfileView,
  setCareContext,
  updateDementiaContext,
} from "@/lib/care-contexts/dementia/server";

function caregiverIdFrom(req: NextRequest, body?: Record<string, unknown>): string {
  const fromQuery = req.nextUrl.searchParams.get("caregiver_id");
  if (fromQuery) return fromQuery;
  if (body && typeof body.caregiver_id === "string") return body.caregiver_id;
  return DEFAULT_CAREGIVER_ID;
}

/** GET /api/care-contexts/dementia */
export async function GET(req: NextRequest) {
  const caregiverId = caregiverIdFrom(req);
  const view = await getDementiaProfileView({ caregiver_id: caregiverId });
  return NextResponse.json({ care_profile: view });
}

/** PATCH /api/care-contexts/dementia — set care context or update dementia fields */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const caregiverId = caregiverIdFrom(req, input);

  if (typeof input.care_context === "string") {
    if (!CARE_CONTEXT_TYPES.includes(input.care_context as CareContextType)) {
      return NextResponse.json({ error: "Invalid care_context" }, { status: 400 });
    }
    const view = await setCareContext({
      caregiver_id: caregiverId,
      care_context: input.care_context as CareContextType,
    });
    return NextResponse.json({ care_profile: view });
  }

  const patch: Parameters<typeof updateDementiaContext>[0]["patch"] = {};

  if (input.dementia_stage !== undefined) {
    if (!validateDementiaStage(input.dementia_stage)) {
      return NextResponse.json({ error: "Invalid dementia_stage" }, { status: 400 });
    }
    patch.dementia_stage = input.dementia_stage;
  }

  if (input.medication_risk !== undefined) {
    if (!validateMedicationRisk(input.medication_risk)) {
      return NextResponse.json({ error: "Invalid medication_risk" }, { status: 400 });
    }
    patch.medication_risk = input.medication_risk;
  }

  if (input.driving_status !== undefined) {
    if (!validateDrivingStatus(input.driving_status)) {
      return NextResponse.json({ error: "Invalid driving_status" }, { status: 400 });
    }
    patch.driving_status = input.driving_status;
  }

  if (input.sundowning_window !== undefined) {
    if (input.sundowning_window === null) {
      patch.clear_sundowning_window = true;
    } else if (!validateSundowningWindow(input.sundowning_window)) {
      return NextResponse.json(
        { error: "sundowning_window requires start and end in HH:MM format" },
        { status: 400 },
      );
    } else {
      patch.sundowning_window = input.sundowning_window as { start: string; end: string };
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide care_context or dementia field updates" },
      { status: 400 },
    );
  }

  try {
    const view = await updateDementiaContext({ caregiver_id: caregiverId, patch });
    return NextResponse.json({ care_profile: view });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 },
    );
  }
}

/** POST /api/care-contexts/dementia — record wandering or financial risk events */
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

  const input = body as Record<string, unknown>;
  const caregiverId = caregiverIdFrom(req, input);
  const action = input.action;

  if (action === "wandering") {
    if (typeof input.description !== "string" || !input.description.trim()) {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }
    try {
      const result = await addWanderingEvent({
        caregiver_id: caregiverId,
        description: input.description,
        trigger: typeof input.trigger === "string" ? input.trigger : undefined,
        location: typeof input.location === "string" ? input.location : undefined,
        timestamp: typeof input.timestamp === "string" ? input.timestamp : undefined,
      });
      return NextResponse.json({ care_profile: result.view, event: result.event });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to record event" },
        { status: 400 },
      );
    }
  }

  if (action === "financial_risk") {
    if (typeof input.description !== "string" || !input.description.trim()) {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }
    try {
      const result = await addFinancialRiskEvent({
        caregiver_id: caregiverId,
        description: input.description,
        timestamp: typeof input.timestamp === "string" ? input.timestamp : undefined,
      });
      return NextResponse.json({ care_profile: result.view, event: result.event });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to record event" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json(
    { error: "action must be wandering or financial_risk" },
    { status: 400 },
  );
}
