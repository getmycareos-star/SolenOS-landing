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
const confirmedSaveMessage = save.indexOf("setMessage('Your note is saved as a caregiver report.')");
const refreshAfterSave = save.indexOf("await refreshSavedWorkspace()", confirmedSaveMessage);
const partialSuccessError = save.indexOf("Your note was saved. Appointment details could not refresh; open appointment support again to retry.", refreshAfterSave);
assert.ok(
  confirmedSaveMessage >= 0 && refreshAfterSave > confirmedSaveMessage && partialSuccessError > refreshAfterSave,
  "a workspace refresh failure after a confirmed write must be reported as partial success, never as a failed save",
);
assert.ok(
  save.includes("Your note is saved. SolenOS could not finish preparing the review suggestions; you can retry."),
  "a review-suggestion failure after a confirmed write must preserve the saved state and offer a retry",
);
console.log("Appointment save checks passed: idempotent retry and truthful partial-success state.");
