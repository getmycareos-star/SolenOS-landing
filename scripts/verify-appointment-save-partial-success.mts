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
const proposalStart = source.indexOf("const prepareOutcomeReview = async () =>");
const proposalEnd = source.indexOf("\\n  const reviewOutcomeProposal", proposalStart);
assert.ok(proposalStart >= 0 && proposalEnd > proposalStart, "appointment proposal preparation handler must exist");
const proposalPreparation = source.slice(proposalStart, proposalEnd);
assert.ok(proposalPreparation.includes("result.written_to_lcr !== false"), "proposal preparation must fail closed unless the server explicitly confirms no Care Record write");
assert.ok(proposalPreparation.includes("SolenOS reported that a care detail was added before you reviewed it."), "an unexpected pre-approval write must be disclosed and trigger a Care Record refresh");
assert.ok(proposalPreparation.includes("SolenOS could not confirm that your Care Record was left unchanged."), "an unknown write outcome must not be presented as a read-only success");
assert.ok(proposalPreparation.indexOf("result.written_to_lcr !== false") < proposalPreparation.indexOf("Nothing is added to your Care Record"), "read-only success copy must appear only after explicit server confirmation");

console.log("Appointment save checks passed: idempotent retry and truthful partial-success state.");
