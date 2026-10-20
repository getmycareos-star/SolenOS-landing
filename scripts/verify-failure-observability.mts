import {
  FailureLogEntrySchema,
  FailureObservabilityCollector,
  classifyParseFailure,
  classifyQualityFailure,
  classifyZodFailure,
  fingerprintOutput,
  fingerprintsDiverge,
  peekLastFailureLogs,
  publishLastFailureLogs,
  clearLastFailureLogs,
} from "../src/lib/failure-observability";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Failure Observability — MINIMAL DEBUG CONTRACT v1 ===\n");

const collector = new FailureObservabilityCollector();
collector.record({ ...classifyParseFailure(), retry_count: 1 });
collector.record({ ...classifyZodFailure(), retry_count: 2 });

const logs = collector.getLogs();
if (logs.length !== 2) {
  throw new Error("expected two failure log entries");
}

for (const log of logs) {
  FailureLogEntrySchema.parse(log);
  const keys = Object.keys(log);
  if (keys.length !== 4) {
    throw new Error("failure log must contain exactly four fields");
  }
  if (JSON.stringify(log).includes("Mom") || JSON.stringify(log).includes("medication")) {
    throw new Error("failure log must not contain user content");
  }
}
console.log("✓ strict metadata-only failure log contract");

publishLastFailureLogs(logs);
if (peekLastFailureLogs().length !== 2) {
  throw new Error("peekLastFailureLogs must expose metadata only");
}
clearLastFailureLogs();
if (peekLastFailureLogs().length !== 0) {
  throw new Error("clearLastFailureLogs must reset debug peek");
}
console.log("✓ ephemeral debug peek (non-persistent)");

const a = validateAIResponse(VERIFY_VALID_SOLENOS);

const b = { ...a, risk_level: "high" as const };
if (!fingerprintsDiverge(fingerprintOutput(a), fingerprintOutput(b))) {
  throw new Error("drift detection must compare risk metadata");
}
console.log("✓ inference inconsistency fingerprint without storing content");

const source = await import("node:fs/promises").then((fs) =>
  fs.readFile("src/lib/failure-observability/collector.ts", "utf-8"),
);
if (/localStorage|database|redis|writeFile|appendFile/i.test(source)) {
  throw new Error("failure observability must not persist data");
}
console.log("✓ no persistence layer in observability module");

console.log("\n✓ failure observability is minimal debug classification only");
