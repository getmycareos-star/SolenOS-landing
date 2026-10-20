const versionByRecipient = new Map<string, number>();

export function nextSnapshotVersion(careRecipientId: string): number {
  const next = (versionByRecipient.get(careRecipientId) ?? 0) + 1;
  versionByRecipient.set(careRecipientId, next);
  return next;
}

export function getSnapshotVersion(careRecipientId: string): number {
  return versionByRecipient.get(careRecipientId) ?? 0;
}

export function resetStateOfCareSummaryStore(): void {
  versionByRecipient.clear();
}
