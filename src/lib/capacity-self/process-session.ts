import { DEFAULT_CAREGIVER_ID } from "./contract-constants";
import type {
  CapacitySelfSessionResult,
  CapacityLevel,
  CareItem,
  ContextType,
  ResolvedItemRecord,
} from "./types";
import { buildBatchView } from "./modules/context-batching";
import { buildCapacityMatchedSuggestion } from "./modules/capacity-suggestions";
import { generateFactualReflection } from "./modules/factual-reflection";
import {
  buildCareItemsFromDescriptions,
  buildCareItemsFromInput,
  mergeOpenItems,
} from "./items/build-care-items";
import {
  getOrCreateCaregiverSelfProfile,
  setSessionCapacity,
  addResolvedItem,
} from "./caregiver-profile/store";
import { tryLoadCaregiverSelfProfile, trySaveCaregiverSelfProfile } from "./caregiver-profile/postgres-store";
import { ingestCaregiverSelfEntry } from "./caregiver-profile/ingest-self";

export type ProcessCapacitySelfSessionParams = {
  caregiver_id?: string;
  /** Latest caregiver input for item extraction. */
  input?: string;
  active_context?: ContextType | null;
  include_reflection?: boolean;
};

export async function processCapacitySelfSession(
  params: ProcessCapacitySelfSessionParams = {},
): Promise<CapacitySelfSessionResult> {
  const caregiverId = params.caregiver_id ?? DEFAULT_CAREGIVER_ID;

  let selfRecord =
    (await tryLoadCaregiverSelfProfile(caregiverId)) ??
    getOrCreateCaregiverSelfProfile(caregiverId);

  const recipientItems: CareItem[] = params.input
    ? buildCareItemsFromInput(params.input, "care_recipient")
    : [];

  const caregiverItemsFromProfile = buildCareItemsFromDescriptions(
    selfRecord.profile.open_item_descriptions,
    "caregiver",
  );

  const caregiverItemsFromInput = params.input
    ? buildCareItemsFromInput(params.input, "caregiver").filter((i) =>
        /\b(my |I need|I'm |caregiver)\b/i.test(i.description) ||
        selfRecord.profile.open_item_descriptions.some(
          (d) => d.toLowerCase() === i.description.toLowerCase(),
        ),
      )
    : [];

  const caregiverItems = mergeOpenItems(caregiverItemsFromProfile, caregiverItemsFromInput);
  const careRecipientItems = recipientItems;
  const allItems = [...careRecipientItems, ...caregiverItems];

  const batch_view = buildBatchView(allItems, params.active_context ?? null);
  const capacity_suggestion = buildCapacityMatchedSuggestion(
    allItems,
    selfRecord.session_capacity,
  );

  const factual_reflection = params.include_reflection
    ? generateFactualReflection(selfRecord.resolved_items)
    : null;

  return {
    batch_view,
    capacity_suggestion,
    factual_reflection,
    caregiver_items: caregiverItems,
    care_recipient_items: careRecipientItems,
  };
}

export async function setCaregiverCapacity(
  caregiverId: string,
  capacity: CapacityLevel,
): Promise<void> {
  const record = setSessionCapacity(caregiverId, capacity);
  await trySaveCaregiverSelfProfile(record);
}

export async function resolveCareItem(params: {
  caregiver_id: string;
  description: string;
  subject: ResolvedItemRecord["subject"];
  context_type: ResolvedItemRecord["context_type"];
  raw_entry_id?: string | null;
}): Promise<ResolvedItemRecord> {
  const resolved: ResolvedItemRecord = {
    id: `resolved_${Date.now()}`,
    description: params.description,
    subject: params.subject,
    context_type: params.context_type,
    resolved_at: new Date().toISOString(),
    raw_entry_id: params.raw_entry_id ?? null,
  };
  const record = addResolvedItem(params.caregiver_id, resolved);
  await trySaveCaregiverSelfProfile(record);
  return resolved;
}

export { ingestCaregiverSelfEntry };
