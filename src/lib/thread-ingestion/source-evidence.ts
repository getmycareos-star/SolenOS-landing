/**
 * Durable full-thread source evidence — Locked B.
 * ACS observations hold fragments; Care Reality interprets; source thread preserved.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export type ThreadSourceEvidence = {
  thread_id: string;
  care_key: string;
  /** Full original paste — never truncated. */
  source_text: string;
  fragment_count: number;
  captured_at: string;
};

type ThreadEvidenceStore = {
  care_key: string;
  threads: ThreadSourceEvidence[];
  updated_at: string;
};

const memory = new Map<string, ThreadEvidenceStore>();

function storePath(careKey: string): string {
  return livingCareRecordDataDir(
    "thread-evidence",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function loadStore(careKey: string): ThreadEvidenceStore {
  const cached = memory.get(careKey);
  if (cached) return cached;
  const durable = readDurableJson<ThreadEvidenceStore>(storePath(careKey));
  if (durable?.threads) {
    memory.set(careKey, durable);
    return durable;
  }
  return { care_key: careKey, threads: [], updated_at: new Date().toISOString() };
}

function saveStore(store: ThreadEvidenceStore): void {
  memory.set(store.care_key, store);
  writeDurableJson(storePath(store.care_key), store);
}

export function recordThreadSourceEvidence(params: {
  careKey: string;
  sourceText: string;
  fragmentCount: number;
  capturedAt?: string;
  threadId?: string;
}): ThreadSourceEvidence {
  const now = params.capturedAt ?? new Date().toISOString();
  const evidence: ThreadSourceEvidence = {
    thread_id:
      params.threadId ??
      `thr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    care_key: params.careKey,
    source_text: params.sourceText,
    fragment_count: params.fragmentCount,
    captured_at: now,
  };
  const store = loadStore(params.careKey);
  const next = [...store.threads.filter((t) => t.thread_id !== evidence.thread_id), evidence].slice(
    -20,
  );
  saveStore({ care_key: params.careKey, threads: next, updated_at: now });
  return evidence;
}

export function listThreadSourceEvidence(careKey: string): ThreadSourceEvidence[] {
  return [...loadStore(careKey).threads];
}

export function getThreadSourceEvidence(
  careKey: string,
  threadId: string,
): ThreadSourceEvidence | null {
  return loadStore(careKey).threads.find((t) => t.thread_id === threadId) ?? null;
}

export function resetThreadSourceEvidenceStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("thread-evidence"));
}
