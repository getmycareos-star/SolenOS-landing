import type { CareContextRoot } from "../situation-entry/types";

export type ComprehensionSnapshot = {
  care_recipient_id: string;
  event_count: number;
  event_fingerprint: string;
  comprehended_at: string;
};

const priorByRecipient = new Map<string, ComprehensionSnapshot>();

function fingerprintContext(context: CareContextRoot): string {
  return context.events
    .map((e) => `${e.id}:${e.status}:${e.timestamp}`)
    .join("|");
}

export function getPriorComprehension(careRecipientId: string): ComprehensionSnapshot | null {
  return priorByRecipient.get(careRecipientId) ?? null;
}

export function recordComprehension(context: CareContextRoot, asOf: string): ComprehensionSnapshot {
  const snapshot: ComprehensionSnapshot = {
    care_recipient_id: context.care_recipient_id,
    event_count: context.events.length,
    event_fingerprint: fingerprintContext(context),
    comprehended_at: asOf,
  };
  priorByRecipient.set(context.care_recipient_id, snapshot);
  return snapshot;
}

export function resetCareContextDiffStore(): void {
  priorByRecipient.clear();
}
