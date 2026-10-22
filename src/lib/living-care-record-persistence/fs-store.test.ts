/** @jest-environment node */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  clearDurableDirectory,
  listDurableDirectory,
  readDurableJson,
  writeDurableJson,
} from "./fs-store";

describe("durable Living Care Record filesystem contract", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "solenos-durable-care-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("round-trips a durable record", () => {
    const path = join(root, "care-context", "record.json");
    const record = { care_key: "caregiver-1", version: 1 };
    writeDurableJson(path, record);
    expect(readDurableJson(path)).toEqual(record);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(record);
  });

  it("distinguishes a missing file from a corrupted existing record", () => {
    expect(readDurableJson(join(root, "missing.json"))).toBeNull();

    const corrupt = join(root, "corrupt.json");
    writeFileSync(corrupt, "{not-json", "utf8");
    expect(() => readDurableJson(corrupt)).toThrow(
      "exists but could not be read or parsed",
    );
  });

  it("throws when a durable write fails instead of claiming cache-only success", () => {
    const parentIsAFile = join(root, "not-a-directory");
    writeFileSync(parentIsAFile, "block", "utf8");
    expect(() => writeDurableJson(join(parentIsAFile, "record.json"), { version: 1 })).toThrow(
      "persistence was not confirmed",
    );
  });

  it("surfaces unreadable durable directories instead of returning an empty list", () => {
    const pathIsAFile = join(root, "not-a-directory");
    writeFileSync(pathIsAFile, "block", "utf8");
    expect(() => listDurableDirectory(pathIsAFile)).toThrow(
      "durable care directory could not be read",
    );
    expect(() => clearDurableDirectory(pathIsAFile)).toThrow(
      "durable care directory could not be cleared completely",
    );
  });
});
