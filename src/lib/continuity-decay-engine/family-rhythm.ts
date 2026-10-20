import { daysBetween } from "./compute-decay";

import type { CanonicalCareEvent } from "../situation-entry/types";

import type { FamilyRhythm } from "./types";

import { getFamilyRhythmProfile, recordUpdateTimestamp } from "./store";



export function learnFamilyRhythm(input: {

  caregiver_id: string;

  all_events: CanonicalCareEvent[];

  as_of: string;

}): FamilyRhythm {

  const sorted = [...input.all_events]

    .filter((e) => e.status !== "invalidated" && e.status !== "superseded")

    .sort((a, b) => a.ingestion_time.localeCompare(b.ingestion_time));



  if (sorted.length > 0) {

    recordUpdateTimestamp(input.caregiver_id, sorted[sorted.length - 1]!.ingestion_time);

  }



  const profile = getFamilyRhythmProfile(input.caregiver_id);

  const lastUpdate = sorted[sorted.length - 1]?.ingestion_time ?? input.as_of;

  const daysSinceLastUpdate = daysBetween(lastUpdate, input.as_of);



  let typicalCadence = profile.typical_cadence_days;

  if (sorted.length >= 2) {

    const gaps: number[] = [];

    for (let i = 1; i < sorted.length; i++) {

      gaps.push(daysBetween(sorted[i - 1]!.ingestion_time, sorted[i]!.ingestion_time));

    }

    gaps.sort((a, b) => a - b);

    typicalCadence = gaps[Math.floor(gaps.length / 2)] ?? typicalCadence;

  }



  const meaningfulGap = daysSinceLastUpdate > typicalCadence * 1.5 && sorted.length >= 1;



  return {

    typical_cadence_days: Math.round(typicalCadence * 10) / 10,

    update_count: sorted.length,

    meaningful_gap: meaningfulGap,

    days_since_last_update: Math.round(daysSinceLastUpdate * 10) / 10,

  };

}


