import { DEFAULT_CAREGIVER_ID } from "./contract-constants";
import type { IngestEntryResult } from "./types";
import { tryLoadProfile, trySaveProfile } from "./care-recipient-profile/postgres-store";
import { ensureDefaultLocations } from "./modules/location-index";
import { computePatternContext } from "./modules/pattern-recognition";
import { synthesizeProfileFromEntry } from "./care-recipient-profile/synthesize";
import { autoTagEntry, mergeUniqueTags } from "./care-recipient-profile/tag-events";
import {
  getOrCreateProfile,
  updateProfileData,
} from "./care-recipient-profile/store";

export type IngestCareEntryParams = {
  content: string;
  raw_entry_id: string;
  caregiver_id?: string;
  case_id?: string | null;
  captured_at?: string;
};

/**
 * Ingest a caregiver entry — update living care record, auto-tag, surface pattern context.
 */
export async function ingestCareEntry(params: IngestCareEntryParams): Promise<IngestEntryResult> {
  const caregiverId = params.caregiver_id ?? DEFAULT_CAREGIVER_ID;
  const caseId = params.case_id ?? null;
  const capturedAt = params.captured_at ?? new Date().toISOString();

  let record =
    (await tryLoadProfile(caregiverId, caseId)) ??
    getOrCreateProfile({ caregiver_id: caregiverId, case_id: caseId });

  const tagsAdded = autoTagEntry(params.content, params.raw_entry_id, capturedAt);
  const priorLog = record.profile.tagged_event_log;

  const pattern_context = computePatternContext(tagsAdded, priorLog, capturedAt);

  record =
    updateProfileData(record.id, (profile) => {
      let next = synthesizeProfileFromEntry(profile, params.content, capturedAt);
      next = {
        ...next,
        tagged_event_log: mergeUniqueTags(priorLog, tagsAdded),
      };
      next = ensureDefaultLocations(next);
      return next;
    }) ?? record;

  await trySaveProfile(record);

  return {
    profile: record,
    pattern_context:
      pattern_context && pattern_context.seen_before && pattern_context.note
        ? pattern_context
        : null,
    tags_added: tagsAdded,
  };
}
