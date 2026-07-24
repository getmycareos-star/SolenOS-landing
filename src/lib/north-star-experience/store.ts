type ExperienceSnapshot = {
  caregiver_id: string;
  experience_score: number;
  experience_test_passed: boolean;
  continuity_voice_enabled: boolean;
  captured_at: string;
};

const snapshots: ExperienceSnapshot[] = [];

export function recordExperienceSnapshot(snapshot: ExperienceSnapshot): void {
  snapshots.push(snapshot);
  if (snapshots.length > 200) snapshots.shift();
}

export function getExperienceSnapshots(caregiverId: string): ExperienceSnapshot[] {
  return snapshots.filter((s) => s.caregiver_id === caregiverId);
}

export function resetNorthStarExperienceStore(): void {
  snapshots.length = 0;
}
