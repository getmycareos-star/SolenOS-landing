export type AttentionLoopRecord = {
  id: string;
  source: string;
  priority?: string | null;
  priority_reasons?: string[] | null;
  status: string;
  deferred_reason?: string | null;
};

export type AttentionChangeRecord = {
  id: string;
  is_active?: boolean;
  superseded_by_change_id?: string | null;
  attention_candidate: boolean;
  follow_up_candidate: boolean;
  confirmation_status?: string | null;
};

const explicitImmediateReasons = new Set([
  "Persisted deadline has passed",
  "Critical consequence of delay was explicitly recorded",
]);

export function selectImmediatePriorities<T extends AttentionLoopRecord>(items: T[]): T[] {
  return items.filter((item) =>
    item.priority === "high" &&
    Array.isArray(item.priority_reasons) &&
    item.priority_reasons.some((reason) => explicitImmediateReasons.has(reason))
  );
}

export function selectDeferredItems<T extends AttentionLoopRecord>(items: T[]): T[] {
  return items.filter((item) =>
    item.status.toLowerCase() === "deferred" ||
    Boolean(item.deferred_reason?.trim())
  );
}

export function selectWatchChanges<T extends AttentionChangeRecord>(items: T[]): T[] {
  return items.filter((item) =>
    item.is_active !== false &&
    item.confirmation_status?.toLowerCase() !== "rejected" &&
    !item.superseded_by_change_id &&
    (item.attention_candidate === true || item.follow_up_candidate === true)
  );
}
