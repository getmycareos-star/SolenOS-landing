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

  it("fails closed when legacy filesystem persistence is invoked in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousOptIn = process.env.SOLENOS_LEGACY_FS_STORE_ENABLED;
    process.env.NODE_ENV = "production";
    delete process.env.SOLENOS_LEGACY_FS_STORE_ENABLED;
    try {
      const path = join(root, "production", "record.json");
      expect(() => writeDurableJson(path, { version: 1 })).toThrow(
        "Legacy filesystem persistence is disabled in production",
      );
      expect(() => readDurableJson(path)).toThrow(
        "Legacy filesystem persistence is disabled in production",
      );
      expect(() => clearDurableDirectory(join(root, "production"))).toThrow(
        "Legacy filesystem persistence is disabled in production",
      );
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousOptIn === undefined) delete process.env.SOLENOS_LEGACY_FS_STORE_ENABLED;
      else process.env.SOLENOS_LEGACY_FS_STORE_ENABLED = previousOptIn;
    }
  });
});
