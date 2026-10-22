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
  readFileSync,
  readdirSync,
  rmSync,
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
  try {
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch {
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
