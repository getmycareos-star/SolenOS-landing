"use client";

// The non-extractable AES-GCM key protects queued payloads at rest in the
// browser profile. It is not a substitute for XSS protection or backend access control.
const DATABASE_NAME = "solenos-durable-write-queue";
const DATABASE_VERSION = 1;
const WRITE_STORE = "writes";
const KEY_STORE = "keys";
const MAX_ATTEMPTS = 8;
const SENDING_LEASE_MS = 15 * 1000;
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 600_000, 1_800_000];

type QueueStatus = "pending" | "sending" | "blocked" | "failed_recoverable";

type StoredWrite = {
  id: string;
  person_id: string;
  caregiver_id: string;
  endpoint: string;
  idempotency_key: string;
  iv: ArrayBuffer | number[];
  ciphertext: ArrayBuffer | number[];
  status: QueueStatus;
  attempts: number;
  next_retry_at: number | null;
  created_at: number;
  updated_at: number;
  last_error: string | null;
};

type DeviceKeyRecord = { id: "device"; key: CryptoKey };

export type DurableWriteSummary = {
  pending: number;
  blocked: number;
  failed_recoverable: number;
};

export type DurableWriteSyncResult = {
  synced: number;
  remaining: number;
  blocked: number;
};

type QueueInput = {
  person_id: string;
  caregiver_id: string;
  endpoint: string;
  idempotency_key: string;
  payload: unknown;
};

type SendWrite = (endpoint: string, payload: unknown) => Promise<unknown>;

let databasePromise: Promise<IDBDatabase> | null = null;
const syncPromises = new Map<string, Promise<DurableWriteSyncResult>>();

function ensureBrowserStorage(): void {
  if (typeof window === "undefined" || !window.indexedDB || !window.crypto?.subtle) {
    throw new Error("Encrypted offline storage is not available in this browser.");
  }
}

function openDatabase(): Promise<IDBDatabase> {
  ensureBrowserStorage();
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WRITE_STORE)) {
        db.createObjectStore(WRITE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Could not open encrypted offline storage."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Offline storage is busy in another tab."));
    };
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage transaction failed."));
  });
}

async function getDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  const readTransaction = db.transaction(KEY_STORE, "readonly");
  const readDone = transactionDone(readTransaction);
  const existing = await requestResult(
    readTransaction.objectStore(KEY_STORE).get("device") as IDBRequest<DeviceKeyRecord | undefined>,
  );
  await readDone;
  if (existing?.key) return existing.key;

  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const writeTransaction = db.transaction(KEY_STORE, "readwrite");
  writeTransaction.objectStore(KEY_STORE).add({ id: "device", key } satisfies DeviceKeyRecord);
  try {
    await transactionDone(writeTransaction);
    return key;
  } catch {
    // Another tab may have created the non-extractable device key first.
    // Re-read that key rather than overwriting it and orphaning its ciphertext.
    const retryTransaction = db.transaction(KEY_STORE, "readonly");
    const retryDone = transactionDone(retryTransaction);
    const winner = await requestResult(
      retryTransaction.objectStore(KEY_STORE).get("device") as IDBRequest<DeviceKeyRecord | undefined>,
    );
    await retryDone;
    if (!winner?.key) throw new Error("The encrypted offline-storage key could not be established.");
    return winner.key;
  }
}

async function encryptPayload(db: IDBDatabase, payload: unknown): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const key = await getDeviceKey(db);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer,
    ciphertext,
  };
}

async function decryptPayload(db: IDBDatabase, record: StoredWrite): Promise<unknown> {
  const key = await getDeviceKey(db);
  const iv = record.iv instanceof ArrayBuffer
    ? new Uint8Array(record.iv)
    : new Uint8Array(record.iv);
  const ciphertext = record.ciphertext instanceof ArrayBuffer
    ? record.ciphertext
    : new Uint8Array(record.ciphertext).buffer;
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function dispatchQueueUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("solenos:offline-queue-updated"));
  }
}

function statusFromError(error: unknown): { blocked: boolean; message: string } {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : null;
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return { blocked: true, message: `The server needs this update reviewed (HTTP ${status}).` };
  }
  if (status === 401 || status === 403) {
    return { blocked: true, message: "This care session needs to be verified before the update can sync." };
  }
  return { blocked: false, message: "The server could not confirm this update yet." };
}

async function getAllWrites(db: IDBDatabase): Promise<StoredWrite[]> {
  const transaction = db.transaction(WRITE_STORE, "readonly");
  const done = transactionDone(transaction);
  const rows = await requestResult(transaction.objectStore(WRITE_STORE).getAll() as IDBRequest<StoredWrite[]>);
  await done;
  return rows;
}

async function putWrite(db: IDBDatabase, record: StoredWrite): Promise<void> {
  const transaction = db.transaction(WRITE_STORE, "readwrite");
  transaction.objectStore(WRITE_STORE).put(record);
  await transactionDone(transaction);
}

async function deleteWrite(db: IDBDatabase, id: string): Promise<void> {
  const transaction = db.transaction(WRITE_STORE, "readwrite");
  transaction.objectStore(WRITE_STORE).delete(id);
  await transactionDone(transaction);
}

async function readWrite(db: IDBDatabase, id: string): Promise<StoredWrite | undefined> {
  const transaction = db.transaction(WRITE_STORE, "readonly");
  const done = transactionDone(transaction);
  const result = await requestResult(
    transaction.objectStore(WRITE_STORE).get(id) as IDBRequest<StoredWrite | undefined>,
  );
  await done;
  return result;
}

function isEligible(record: StoredWrite, now: number): boolean {
  if (record.status === "blocked" || record.status === "failed_recoverable") return false;
  if (record.status === "sending") return now - record.updated_at >= SENDING_LEASE_MS;
  return record.next_retry_at === null || record.next_retry_at <= now;
}

export function durableWriteId(endpoint: string, idempotencyKey: string): string {
  return `${endpoint}:${idempotencyKey}`;
}

export async function discardDurableWrite(id: string): Promise<void> {
  const db = await openDatabase();
  await deleteWrite(db, id);
  dispatchQueueUpdated();
}

export async function enqueueDurableWrite(input: QueueInput): Promise<string> {
  if (!input.person_id || !input.caregiver_id || !input.idempotency_key || !input.endpoint.startsWith("/")) {
    throw new Error("A verified care identity and stable request key are required for offline storage.");
  }
  const db = await openDatabase();
  const id = durableWriteId(input.endpoint, input.idempotency_key);
  const existing = await readWrite(db, id);
  const encrypted = await encryptPayload(db, input.payload);
  const now = Date.now();

  if (existing) {
    const existingPayload = await decryptPayload(db, existing);
    if (
      existing.person_id !== input.person_id ||
      existing.caregiver_id !== input.caregiver_id ||
      JSON.stringify(existingPayload) !== JSON.stringify(input.payload)
    ) {
      throw new Error("This request key is already assigned to a different offline update.");
    }
    return id;
  }

  await putWrite(db, {
    id,
    person_id: input.person_id,
    caregiver_id: input.caregiver_id,
    endpoint: input.endpoint,
    idempotency_key: input.idempotency_key,
    ...encrypted,
    // Reserve the write before the caller begins its direct request. If the
    // page exits between enqueue and send, the lease expires and sync recovers it.
    status: "sending",
    attempts: 0,
    next_retry_at: now,
    created_at: now,
    updated_at: now,
    last_error: null,
  });
  return id;
}

export async function hasDurableWrite(id: string): Promise<boolean> {
  const db = await openDatabase();
  return Boolean(await readWrite(db, id));
}

export async function completeDurableWrite(id: string): Promise<void> {
  const db = await openDatabase();
  await deleteWrite(db, id);
  dispatchQueueUpdated();
}

export async function markDurableWritePending(
  id: string,
  error: unknown,
  options: { countAttempt?: boolean } = {},
): Promise<void> {
  const db = await openDatabase();
  const record = await readWrite(db, id);
  if (!record) return;
  const classification = statusFromError(error);
  // A known-offline decision happens before any network attempt and must not
  // consume the bounded retry budget.
  const attempts = record.attempts + (options.countAttempt === false ? 0 : 1);
  const exhausted = attempts >= MAX_ATTEMPTS;
  const status: QueueStatus = classification.blocked
    ? "blocked"
    : exhausted ? "failed_recoverable" : "pending";
  const delay = options.countAttempt === false
    ? 0
    : RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)] ?? 1_800_000;
  await putWrite(db, {
    ...record,
    status,
    attempts,
    next_retry_at: status === "pending" ? Date.now() + delay : null,
    updated_at: Date.now(),
    last_error: classification.message,
  });
  dispatchQueueUpdated();
}

export async function deliverDurableWrite<T>(
  id: string,
  send: SendWrite,
): Promise<T> {
  const db = await openDatabase();
  const record = await readWrite(db, id);
  if (!record) throw new Error("The pending update is no longer in the local queue.");

  await putWrite(db, { ...record, status: "sending", updated_at: Date.now() });
  try {
    const payload = await decryptPayload(db, record);
    const result = await send(record.endpoint, payload);
    await deleteWrite(db, id);
    dispatchQueueUpdated();
    return result as T;
  } catch (error) {
    await markDurableWritePending(id, error);
    throw error;
  }
}

export async function getDurableWriteSummary(
  personId: string,
  caregiverId: string,
  endpoints?: string[],
): Promise<DurableWriteSummary> {
  const db = await openDatabase();
  const rows = await getAllWrites(db);
  const matching = rows.filter((row) =>
    row.person_id === personId &&
    row.caregiver_id === caregiverId &&
    (!endpoints || endpoints.includes(row.endpoint))
  );
  return {
    pending: matching.filter((row) => row.status === "pending" || row.status === "sending").length,
    blocked: matching.filter((row) => row.status === "blocked").length,
    failed_recoverable: matching.filter((row) => row.status === "failed_recoverable").length,
  };
}

export async function discardBlockedDurableWrites(
  personId: string,
  caregiverId: string,
  endpoints?: string[],
): Promise<number> {
  const db = await openDatabase();
  const rows = await getAllWrites(db);
  let removed = 0;
  for (const row of rows) {
    if (
      row.person_id === personId &&
      row.caregiver_id === caregiverId &&
      (!endpoints || endpoints.includes(row.endpoint)) &&
      (row.status === "blocked" || row.status === "failed_recoverable")
    ) {
      await deleteWrite(db, row.id);
      removed += 1;
    }
  }
  if (removed > 0) dispatchQueueUpdated();
  return removed;
}

export async function retryPendingDurableWrites(
  personId: string,
  caregiverId: string,
  endpoints?: string[],
): Promise<number> {
  const db = await openDatabase();
  const rows = await getAllWrites(db);
  let retried = 0;
  const now = Date.now();
  for (const row of rows) {
    if (
      row.person_id === personId &&
      row.caregiver_id === caregiverId &&
      (!endpoints || endpoints.includes(row.endpoint)) &&
      row.status === "pending" &&
      row.next_retry_at != null &&
      row.next_retry_at > now
    ) {
      await putWrite(db, {
        ...row,
        next_retry_at: now,
        updated_at: now,
      });
      retried += 1;
    }
  }
  if (retried > 0) dispatchQueueUpdated();
  return retried;
}

export async function retryBlockedDurableWrites(
  personId: string,
  caregiverId: string,
  endpoints?: string[],
): Promise<void> {
  const db = await openDatabase();
  const rows = await getAllWrites(db);
  for (const row of rows) {
    if (
      row.person_id === personId &&
      row.caregiver_id === caregiverId &&
      (!endpoints || endpoints.includes(row.endpoint)) &&
      (row.status === "blocked" || row.status === "failed_recoverable")
    ) {
      await putWrite(db, {
        ...row,
        status: "pending",
        attempts: 0,
        next_retry_at: Date.now(),
        updated_at: Date.now(),
        last_error: null,
      });
    }
  }
  dispatchQueueUpdated();
}

export async function syncDurableWrites(input: {
  personId: string;
  caregiverId: string;
  send: SendWrite;
  endpoints?: string[];
  onSynced?: (endpoint: string, payload: unknown, result: unknown) => void;
}): Promise<DurableWriteSyncResult> {
  const identityKey = `${input.personId}:${input.caregiverId}`;
  const existingSync = syncPromises.get(identityKey);
  if (existingSync) return existingSync;
  const currentSync = (async () => {
    const db = await openDatabase();
    const now = Date.now();
    const rows = await getAllWrites(db);
    let synced = 0;

    for (const row of rows) {
      if (row.person_id !== input.personId || row.caregiver_id !== input.caregiverId) continue;
      if (input.endpoints && !input.endpoints.includes(row.endpoint)) continue;
      if (!isEligible(row, now)) continue;
      try {
        const payload = await decryptPayload(db, row);
        const result = await deliverDurableWrite(row.id, input.send);
        synced += 1;
        try {
          input.onSynced?.(row.endpoint, payload, result);
        } catch {
          // The server receipt is already durable. A local UI callback must not
          // turn a completed write back into a failed or retryable queue item.
        }
      } catch {
        // The queue retains retryable and blocked records with the same idempotency key.
      }
    }

    const remainingRows = await getAllWrites(db);
    const matching = remainingRows.filter((row) =>
      row.person_id === input.personId &&
      row.caregiver_id === input.caregiverId &&
      (!input.endpoints || input.endpoints.includes(row.endpoint)),
    );
    return {
      synced,
      remaining: matching.filter((row) => row.status === "pending" || row.status === "sending" || row.status === "failed_recoverable").length,
      blocked: matching.filter((row) => row.status === "blocked").length,
    };
  })().finally(() => {
    syncPromises.delete(identityKey);
  });
  syncPromises.set(identityKey, currentSync);
  return currentSync;
}
