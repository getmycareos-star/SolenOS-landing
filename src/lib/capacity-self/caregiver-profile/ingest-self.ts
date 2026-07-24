import { autoTagEntry, mergeUniqueTags } from "../../cognitive-relief/care-recipient-profile/tag-events";
import { buildCareItemsFromInput } from "../items/build-care-items";
import {
  getOrCreateCaregiverSelfProfile,
  updateCaregiverSelfProfile,
} from "./store";
import { splitInputBySubject, synthesizeCaregiverBasics } from "./detect-self";

export type IngestSelfEntryResult = {
  caregiver_items_added: number;
  profile_updated: boolean;
};

/**
 * Ingest caregiver-self content into the same structured profile as care recipient.
 */
export function ingestCaregiverSelfEntry(params: {
  content: string;
  raw_entry_id: string;
  caregiver_id: string;
  captured_at?: string;
}): IngestSelfEntryResult {
  const { caregiverText } = splitInputBySubject(params.content);
  const text = caregiverText ?? (/\b(my |I need|I'm )\b/i.test(params.content) ? params.content : null);
  if (!text) {
    return { caregiver_items_added: 0, profile_updated: false };
  }

  const capturedAt = params.captured_at ?? new Date().toISOString();
  const items = buildCareItemsFromInput(text, "caregiver");
  const tags = autoTagEntry(text, params.raw_entry_id, capturedAt);

  updateCaregiverSelfProfile(params.caregiver_id, (profile) => {
    const descriptions = [
      ...profile.open_item_descriptions,
      ...items.map((i) => i.description),
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    return {
      ...profile,
      caregiver_basics: synthesizeCaregiverBasics(text, profile.caregiver_basics),
      tagged_event_log: mergeUniqueTags(profile.tagged_event_log, tags) as typeof profile.tagged_event_log,
      open_item_descriptions: descriptions.slice(-40),
    };
  });

  return { caregiver_items_added: items.length, profile_updated: true };
}
