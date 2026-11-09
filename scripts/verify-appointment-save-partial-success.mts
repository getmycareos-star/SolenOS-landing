import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/components/workflows/AppointmentWorkspace.tsx", "utf8");
const start = source.indexOf("const saveNote = async () =>");
const end = source.indexOf("\n  return (", start);
assert.ok(start >= 0 && end > start, "appointment save handler must exist");
const save = source.slice(start, end);

assert.ok(save.includes("setSaveRetry({ signature: saveSignature, key: requestKey })"), "the pending request key must survive an ambiguous write failure");
assert.ok(save.includes("idempotency_key: requestKey"), "appointment create and update requests must send the same idempotency key on retry");
assert.ok(save.includes("setRecord(saved)"), "the confirmed durable record must update local state");
assert.ok(save.includes("setSaveRetry(null)"), "a confirmed write must release its pending retry key");
assert.match(
  save,
  /if \(stage === 'after'\) \{\s*try \{\s*await refreshOutcome\(saved\.id\)\s*\} catch \{\s*setError\('Your note was saved\. The outcome view could not refresh; use Refresh outcome to retry\.'\)\s*\}\s*\}/s,
  "an outcome refresh failure after a confirmed write must be reported as partial success, never as a failed save",
);
console.log("Appointment save checks passed: idempotent retry and truthful partial-success state.");
