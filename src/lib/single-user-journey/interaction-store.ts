const interactionCounts = new Map<string, number>();

export function nextInteractionIndex(caregiverId: string): number {
  const next = (interactionCounts.get(caregiverId) ?? 0) + 1;
  interactionCounts.set(caregiverId, next);
  return next;
}

export function getInteractionIndex(caregiverId: string): number {
  return interactionCounts.get(caregiverId) ?? 0;
}

export function resetJourneyInteractionStore(): void {
  interactionCounts.clear();
}
