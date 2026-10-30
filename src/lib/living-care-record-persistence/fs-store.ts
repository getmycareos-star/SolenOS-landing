/**
 * Filesystem durability for Living Care Record spine (mirrors consent-store).
 * Maps are cache; `.data/` JSON is source of truth across process restarts.
 *
 * Client bundles must never resolve `node:fs`. This module uses Node `fs`/`path`
 * only on the server; browser callers get no-ops (in-memory Maps remain source
 * of truth for that tab).
 */

import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { requireCaregiverId } from "../care-identity/durable-care-key";

const isBrowser = typeof window !== "undefined";

export function livingCareRecordDataDir(...parts: string[]): string {
  if (isBrowser) return ["browser-data", ...parts].join("/");
  return join(process.cwd(), ".data", ...parts);
}

export function sanitizeDurableCareKey(careKey: string): string {
  const validated = requireCaregiverId(careKey, "durable care key");
  const cleaned = validated.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  if (!cleaned) throw new Error("A valid durable care key is required.");
  return cleaned;
}

export function readDurableJson<T>(filePath: string): T | null {
  if (isBrowser) return null;
  let exists: boolean;
  try {
    exists = existsSync(filePath);
  } catch {
    throw new Error("Durable care record availability could not be checked.");
  }
  if (!exists) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    throw new Error(
      "A durable care record exists but could not be read or parsed; it was not treated as missing.",
    );
  }
}

export function writeDurableJson(filePath: string, value: unknown): void {
  if (isBrowser) return;
  const directory = join(filePath, "..");
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    mkdirSync(directory, { recursive: true });
    // Write beside the destination and atomically rename: readers see either
    // the previous complete JSON document or the next complete one, never a
    // truncated half-write after a process interruption.
    writeFileSync(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporaryPath, filePath);
  } catch {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original persistence failure.
    }
    throw new Error(
      "The durable care record could not be written; persistence was not confirmed.",
    );
  }
}

export function deleteDurableFile(filePath: string): void {
  if (isBrowser) return;
  let exists: boolean;
  try {
    exists = existsSync(filePath);
  } catch {
    throw new Error("The durable care record could not be checked before deletion.");
  }
  if (!exists) return;
  try {
    rmSync(filePath, { force: true });
  } catch {
    throw new Error("The durable care record could not be deleted.");
  }
}

export function clearDurableDirectory(dirPath: string): void {
  if (isBrowser) return;
  let exists: boolean;
  try {
    exists = existsSync(dirPath);
  } catch {
    throw new Error("The durable care directory could not be checked.");
  }
  if (!exists) return;
  try {
    for (const name of readdirSync(dirPath)) {
      rmSync(join(dirPath, name), { force: true, recursive: true });
    }
  } catch {
    throw new Error("The durable care directory could not be cleared completely.");
  }
}


/**
 * Cross-process critical section for read-modify-write care-record operations.
 * Lock acquisition is exclusive; bounded wait fails closed rather than silently
 * dropping a concurrent caregiver update.
 */
export function withDurableFileLock<T>(
  lockPath: string,
  operation: () => T,
  timeoutMs = 5000,
): T {
  if (isBrowser) return operation();
  mkdirSync(join(lockPath, ".."), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let descriptor: number | null = null;
  while (descriptor === null) {
    try {
      descriptor = openSync(lockPath, "wx", 0o600);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw new Error("Care record write lock could not be acquired.");
      }
      if (Date.now() >= deadline) {
        throw new Error("Care record is busy; concurrent update was not applied.");
      }
      // Synchronous bounded backoff: no unprotected read-modify-write window.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    try {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    } catch {
      throw new Error("Care record write lock could not be released safely.");
    }
  }
}

/** List basename files in a durable data directory (server only). */
export function listDurableDirectory(dirPath: string): string[] {
  if (isBrowser) return [];
  let exists: boolean;
  try {
    exists = existsSync(dirPath);
  } catch {
    throw new Error("The durable care directory could not be checked.");
  }
  if (!exists) return [];
  try {
    return readdirSync(dirPath);
  } catch {
    throw new Error("The durable care directory could not be read.");
  }
}
