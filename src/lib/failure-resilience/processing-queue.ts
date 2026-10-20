import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from "./contract-constants";
import type { FailureCategory, PendingProcessing, ProcessingStatus } from "./types";

const pendingByCaregiver = new Map<string, PendingProcessing[]>();

function createPendingId(): string {
  return `pp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueuePendingProcessing(input: {
  caregiver_id: string;
  raw_input_id: string;
  content_preview: string;
  failure_category: FailureCategory;
  error_message?: string | null;
}): PendingProcessing {
  const now = new Date().toISOString();
  const entry: PendingProcessing = {
    id: createPendingId(),
    caregiver_id: input.caregiver_id,
    raw_input_id: input.raw_input_id,
    content_preview: input.content_preview.slice(0, 200),
    failure_category: input.failure_category,
    status: "pending",
    retry_count: 0,
    max_retries: MAX_RETRY_ATTEMPTS,
    next_retry_at: new Date(Date.now() + RETRY_BACKOFF_MS).toISOString(),
    error_message: input.error_message ?? null,
    preserved_at: now,
  };

  const list = pendingByCaregiver.get(input.caregiver_id) ?? [];
  list.push(entry);
  pendingByCaregiver.set(input.caregiver_id, list);
  return entry;
}

export function getPendingProcessing(caregiverId: string): PendingProcessing[] {
  return [...(pendingByCaregiver.get(caregiverId) ?? [])];
}

export function getRetryablePending(caregiverId: string): PendingProcessing[] {
  const now = Date.now();
  return getPendingProcessing(caregiverId).filter(
    (p) =>
      (p.status === "pending" || p.status === "failed_recoverable") &&
      p.retry_count < p.max_retries &&
      (p.next_retry_at === null || new Date(p.next_retry_at).getTime() <= now),
  );
}

export function markRetryAttempt(
  caregiverId: string,
  pendingId: string,
): PendingProcessing | null {
  const list = pendingByCaregiver.get(caregiverId);
  if (!list) return null;
  const idx = list.findIndex((p) => p.id === pendingId);
  if (idx < 0) return null;

  const entry = list[idx]!;
  const nextCount = entry.retry_count + 1;
  const updated: PendingProcessing = {
    ...entry,
    retry_count: nextCount,
    status: nextCount >= entry.max_retries ? "failed_recoverable" : "pending",
    next_retry_at:
      nextCount >= entry.max_retries
        ? null
        : new Date(Date.now() + RETRY_BACKOFF_MS * nextCount).toISOString(),
  };
  list[idx] = updated;
  return updated;
}

export function completePendingProcessing(
  caregiverId: string,
  pendingId: string,
  status: ProcessingStatus = "complete",
): PendingProcessing | null {
  const list = pendingByCaregiver.get(caregiverId);
  if (!list) return null;
  const idx = list.findIndex((p) => p.id === pendingId);
  if (idx < 0) return null;

  const updated: PendingProcessing = { ...list[idx]!, status };
  list[idx] = updated;
  return updated;
}

export function resetFailureResilienceStore(): void {
  pendingByCaregiver.clear();
}
