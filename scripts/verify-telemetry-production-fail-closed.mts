import assert from "node:assert/strict";
import { getTelemetryStore, resetTelemetryStoreForTests } from "../src/lib/telemetry-persistence/server";

async function main() {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDisabled = process.env.SOLENOS_TELEMETRY_DISABLED;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.SOLENOS_TELEMETRY_DISABLED;
    resetTelemetryStoreForTests();

    await assert.rejects(
      getTelemetryStore(),
      /PostgreSQL DATABASE_URL is required for production telemetry persistence/,
      "production must fail closed instead of silently using process memory",
    );

    process.env.SOLENOS_TELEMETRY_DISABLED = "1";
    resetTelemetryStoreForTests();
    console.log("Production telemetry persistence fails closed without PostgreSQL; explicit telemetry disable remains supported.");
  } finally {
    resetTelemetryStoreForTests();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDisabled === undefined) delete process.env.SOLENOS_TELEMETRY_DISABLED;
    else process.env.SOLENOS_TELEMETRY_DISABLED = previousDisabled;
  }
}

void main();
