/**
 * Filesystem durability for Living Care Record spine (mirrors consent-store).
 * Maps are cache; `.data/` JSON is source of truth across process restarts.
 *
 * Server-only filesystem persistence. Browser calls fail explicitly; an in-memory
 * cache is never described as durable storage.
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

const isBrowser = typeof window !== "undefined";

export function livingCareRecordDataDir(...parts: string[]): string {
  if (isBrowser) throw new Error("Filesystem persistence is server-only; use the authenticated backend API from the browser.");
  return join(process.cwd(), ".data", ...parts);
}

export function sanitizeDurableCareKey(careKey: string): string {
  const normalized = careKey?.trim();
  if (!normalized || normalized === "default_caregiver") throw new Error("Valid durable care key is required; shared fallback storage is prohibited.");
  const cleaned = normalized.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  if (!cleaned) throw new Error("Durable care key is invalid.");
  return cleaned;
}

export function readDurableJson<T>(filePath: string): T | null {
  if (isBrowser) throw new Error("Filesystem persistence is unavailable in the browser.");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    throw new Error("Unable to read durable care data; unavailable storage cannot be treated as an empty record.");
  }
}

export function writeDurableJson(filePath: string, value: unknown): void {
  if (isBrowser) throw new Error("Filesystem persistence is unavailable in the browser.");
  try {
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch {
    throw new Error("Unable to write durable care data; save was not confirmed.");
  }
}

export function deleteDurableFile(filePath: string): void {
  if (isBrowser) throw new Error("Filesystem persistence is unavailable in the browser.");
  try {
    if (existsSync(filePath)) rmSync(filePath, { force: true });
  } catch {
    throw new Error("Unable to delete durable care data.");
  }
}

export function clearDurableDirectory(dirPath: string): void {
  if (isBrowser) throw new Error("Filesystem persistence is unavailable in the browser.");
  try {
    if (!existsSync(dirPath)) return;
    for (const name of readdirSync(dirPath)) {
      rmSync(join(dirPath, name), { force: true, recursive: true });
    }
  } catch {
    throw new Error("Unable to clear durable care data.");
  }
}

/** List basename files in a durable data directory (server only). */
export function listDurableDirectory(dirPath: string): string[] {
  if (isBrowser) throw new Error("Filesystem persistence is unavailable in the browser.");
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath);
  } catch {
    throw new Error("Unable to list durable care data; unavailable storage cannot be treated as an empty directory.");
  }
}
