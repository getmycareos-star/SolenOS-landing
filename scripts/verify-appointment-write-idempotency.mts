import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/workflows/AppointmentWorkspace.tsx", "utf8");
assert.ok(component.includes("pendingSaveRef"), "appointment saves must retain a pending request key across retries");
assert.ok(component.includes("fingerprint"), "the pending key must be replaced when caregiver-entered content changes");
assert.ok(component.includes("idempotency_key: pendingSave.key"), "create and update requests must send the server idempotency key");
assert.ok(component.includes("pendingSaveRef.current = null"), "a confirmed save must release its pending key");
assert.ok(component.includes("Your note was saved. The outcome view could not refresh"), "an outcome refresh failure must not be reported as a failed save");
console.log("Appointment save idempotency and partial-refresh contract checks passed.");
