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
const confirmedWriteIndex = save.indexOf("setRecord(saved)");
const refreshIndex = save.indexOf("await refreshSavedWorkspace()");
assert.ok(confirmedWriteIndex >= 0 && refreshIndex > confirmedWriteIndex, "the durable write must be confirmed in local state before attempting a refresh");
assert.ok(save.indexOf("setSaveRetry(null)") > confirmedWriteIndex && save.indexOf("setSaveRetry(null)") < refreshIndex, "a confirmed write must release its retry key before a later refresh can fail");
assert.ok(save.includes("Your note is saved. SolenOS could not finish preparing the review suggestions; you can retry."), "an after-visit suggestion refresh failure must preserve the confirmed save");
assert.ok(save.includes("Your note was saved. Appointment details could not refresh; open appointment support again to retry."), "an appointment refresh failure after a confirmed write must be reported as partial success, never as a failed save");
console.log("Appointment save checks passed: idempotent retry and truthful partial-success state.");
