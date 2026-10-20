type FamilyRhythmProfile = {

  update_timestamps: string[];

  typical_cadence_days: number;

};



const rhythmProfiles = new Map<string, FamilyRhythmProfile>();



const DEFAULT_CADENCE_DAYS = 7;



export function getFamilyRhythmProfile(caregiverId: string): FamilyRhythmProfile {

  return (

    rhythmProfiles.get(caregiverId) ?? {

      update_timestamps: [],

      typical_cadence_days: DEFAULT_CADENCE_DAYS,

    }

  );

}



export function recordUpdateTimestamp(caregiverId: string, timestamp: string): void {

  const profile = getFamilyRhythmProfile(caregiverId);

  if (profile.update_timestamps[profile.update_timestamps.length - 1] === timestamp) return;

  profile.update_timestamps.push(timestamp);

  if (profile.update_timestamps.length > 50) {

    profile.update_timestamps = profile.update_timestamps.slice(-50);

  }

  rhythmProfiles.set(caregiverId, profile);

}



export function recordDecaySnapshot(input: {

  caregiver_id: string;

  continuity_confidence_pct: number;

  object_confidence: unknown[];

  captured_at: string;

}): void {

  const key = `${input.caregiver_id}:${input.captured_at}`;

  decaySnapshots.set(key, input);

}



const decaySnapshots = new Map<string, unknown>();



export function resetContinuityDecayStore(): void {

  rhythmProfiles.clear();

  decaySnapshots.clear();

}


