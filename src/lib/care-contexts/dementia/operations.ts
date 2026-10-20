import { DEFAULT_CAREGIVER_ID } from "@/lib/cognitive-relief/contract-constants";
import {
  getOrCreateProfile,
  patchProfileRecord,
} from "@/lib/cognitive-relief/care-recipient-profile/store";
import {
  tryLoadProfile,
  trySaveProfile,
} from "@/lib/cognitive-relief/care-recipient-profile/postgres-store";
import type { CareRecipientProfileRecord } from "@/lib/cognitive-relief/types";
import type { CareContextType } from "../types";
import { DEFAULT_DEMENTIA_CONTEXT } from "./defaults";
import type {
  DementiaContext,
  DementiaProfileView,
  DrivingStatus,
  FinancialRiskEvent,
  WanderingEvent,
} from "./types";
import { parseDementiaContext } from "./validate";

export function createEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type { DementiaProfileView };

function toView(record: CareRecipientProfileRecord): DementiaProfileView {
  return {
    id: record.id,
    care_context: record.care_context,
    dementia_context: record.dementia_context,
    current_medications: record.profile.current_medications,
  };
}

async function resolveRecord(params: {
  caregiver_id?: string;
  case_id?: string | null;
}): Promise<CareRecipientProfileRecord> {
  const caregiverId = params.caregiver_id ?? DEFAULT_CAREGIVER_ID;
  const caseId = params.case_id ?? null;
  return (
    (await tryLoadProfile(caregiverId, caseId)) ??
    getOrCreateProfile({ caregiver_id: caregiverId, case_id: caseId })
  );
}

async function persist(record: CareRecipientProfileRecord): Promise<CareRecipientProfileRecord> {
  await trySaveProfile(record);
  return record;
}

export async function getDementiaProfileView(params: {
  caregiver_id?: string;
  case_id?: string | null;
}): Promise<DementiaProfileView> {
  const record = await resolveRecord(params);
  return toView(record);
}

export async function setCareContext(params: {
  caregiver_id?: string;
  case_id?: string | null;
  care_context: CareContextType;
}): Promise<DementiaProfileView> {
  const record = await resolveRecord(params);
  const dementia_context =
    params.care_context === "dementia"
      ? (record.dementia_context ?? { ...DEFAULT_DEMENTIA_CONTEXT })
      : null;

  const updated =
    patchProfileRecord(record.id, {
      care_context: params.care_context,
      dementia_context,
    }) ?? record;

  return toView(await persist(updated));
}

export async function updateDementiaContext(params: {
  caregiver_id?: string;
  case_id?: string | null;
  patch: Partial<
    Pick<
      DementiaContext,
      "dementia_stage" | "medication_risk" | "sundowning_window" | "driving_status"
    >
  > & { clear_sundowning_window?: boolean };
}): Promise<DementiaProfileView> {
  const record = await resolveRecord(params);
  if (record.care_context !== "dementia") {
    throw new Error("care_context must be dementia to update dementia context");
  }

  const current = parseDementiaContext(record.dementia_context);
  const { clear_sundowning_window, ...contextPatch } = params.patch;
  let nextContext: DementiaContext = { ...current, ...contextPatch };

  if (clear_sundowning_window) {
    const { sundowning_window: _removed, ...rest } = nextContext;
    nextContext = rest as DementiaContext;
  }

  if (
    params.patch.driving_status &&
    params.patch.driving_status !== current.driving_status
  ) {
    nextContext = {
      ...nextContext,
      driving_status_history: [
        ...current.driving_status_history,
        {
          status: params.patch.driving_status,
          recorded_at: new Date().toISOString(),
        },
      ],
    };
  }

  const updated =
    patchProfileRecord(record.id, { dementia_context: nextContext }) ?? record;
  return toView(await persist(updated));
}

export async function addWanderingEvent(params: {
  caregiver_id?: string;
  case_id?: string | null;
  description: string;
  trigger?: string;
  location?: string;
  timestamp?: string;
}): Promise<{ view: DementiaProfileView; event: WanderingEvent }> {
  const record = await resolveRecord(params);
  if (record.care_context !== "dementia") {
    throw new Error("care_context must be dementia to record wandering events");
  }

  const current = parseDementiaContext(record.dementia_context);
  const event: WanderingEvent = {
    id: createEventId("wander"),
    timestamp: params.timestamp ?? new Date().toISOString(),
    description: params.description.trim(),
    ...(params.trigger?.trim() ? { trigger: params.trigger.trim() } : {}),
    ...(params.location?.trim() ? { location: params.location.trim() } : {}),
  };

  const nextContext: DementiaContext = {
    ...current,
    wandering_events: [event, ...current.wandering_events],
  };

  const updated =
    patchProfileRecord(record.id, { dementia_context: nextContext }) ?? record;
  return { view: toView(await persist(updated)), event };
}

export async function addFinancialRiskEvent(params: {
  caregiver_id?: string;
  case_id?: string | null;
  description: string;
  timestamp?: string;
}): Promise<{ view: DementiaProfileView; event: FinancialRiskEvent }> {
  const record = await resolveRecord(params);
  if (record.care_context !== "dementia") {
    throw new Error("care_context must be dementia to record financial risk observations");
  }

  const current = parseDementiaContext(record.dementia_context);
  const event: FinancialRiskEvent = {
    id: createEventId("fin_risk"),
    timestamp: params.timestamp ?? new Date().toISOString(),
    description: params.description.trim(),
  };

  const nextContext: DementiaContext = {
    ...current,
    possible_financial_risk_events: [event, ...current.possible_financial_risk_events],
  };

  const updated =
    patchProfileRecord(record.id, { dementia_context: nextContext }) ?? record;
  return { view: toView(await persist(updated)), event };
}

export async function updateDrivingStatus(params: {
  caregiver_id?: string;
  case_id?: string | null;
  driving_status: DrivingStatus;
}): Promise<DementiaProfileView> {
  return updateDementiaContext({
    caregiver_id: params.caregiver_id,
    case_id: params.case_id,
    patch: { driving_status: params.driving_status },
  });
}
