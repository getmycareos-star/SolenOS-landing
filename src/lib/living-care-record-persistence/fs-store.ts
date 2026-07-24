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

const isBrowser = typeof window !== "undefined";

export function livingCareRecordDataDir(...parts: string[]): string {
  if (isBrowser) return ["browser-data", ...parts].join("/");
  return join(process.cwd(), ".data", ...parts);
}

export function sanitizeDurableCareKey(careKey: string): string {
  const cleaned = careKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return cleaned || "default_caregiver";
}

export function readDurableJson<T>(filePath: string): T | null {
  if (isBrowser) return null;
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeDurableJson(filePath: string, value: unknown): void {
  if (isBrowser) return;
  try {
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch {
    // Non-fatal — cache remains for this process.
  }
}

export function deleteDurableFile(filePath: string): void {
  if (isBrowser) return;
  try {
    if (existsSync(filePath)) rmSync(filePath, { force: true });
  } catch {
    // Non-fatal
  }
}

export function clearDurableDirectory(dirPath: string): void {
  if (isBrowser) return;
  try {
    if (!existsSync(dirPath)) return;
    for (const name of readdirSync(dirPath)) {
      rmSync(join(dirPath, name), { force: true, recursive: true });
    }
  } catch {
    // Non-fatal
  }
}

/** List basename files in a durable data directory (server only). */
export function listDurableDirectory(dirPath: string): string[] {
  if (isBrowser) return [];
  try {
    if (!existsSync(dirPath)) return [];
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}
