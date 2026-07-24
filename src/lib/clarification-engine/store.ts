const familyHints = new Map<string, string[]>();

export function getAdaptiveHints(caregiverId: string, topic: string): string[] {
  const key = `${caregiverId}:${topic}`;
  return familyHints.get(key) ?? [];
}

export function recordClarificationOutcome(input: {
  caregiver_id: string;
  topic: string;
  question_answered: boolean;
}): void {
  if (!input.question_answered) return;
  const key = `${input.caregiver_id}:${input.topic}`;
  const existing = familyHints.get(key) ?? [];
  if (!existing.includes(input.topic)) {
    familyHints.set(key, [...existing, input.topic].slice(-10));
  }
}

export function resetClarificationStore(): void {
  familyHints.clear();
}
