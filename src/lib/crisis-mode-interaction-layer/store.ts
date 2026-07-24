type UrgentInputRecord = { captured_at: string; raw_input: string };

const store = new Map<string, UrgentInputRecord[]>();

export function recordUrgentInput(caregiverId: string, rawInput: string, capturedAt: string): void {
  const prior = store.get(caregiverId) ?? [];
  store.set(caregiverId, [...prior.slice(-19), { captured_at: capturedAt, raw_input: rawInput }]);
}

export function countRecentUrgentInputs(
  caregiverId: string,
  windowMinutes: number,
  asOf: string,
): number {
  const records = store.get(caregiverId) ?? [];
  const cutoff = new Date(asOf).getTime() - windowMinutes * 60 * 1000;
  return records.filter((r) => new Date(r.captured_at).getTime() >= cutoff).length;
}

export function resetCrisisModeStore(): void {
  store.clear();
}
