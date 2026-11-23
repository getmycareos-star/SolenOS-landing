import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/components/workflows/CareHandoffSharing.tsx", "utf8");
assert.match(source, /getJSON\("\/consent"\)/, "handoff loading reads persisted backend consent first");
assert.match(source, /consent\.verified === true && consent\.required === false/, "only server-confirmed required consent unlocks incoming handoffs");
assert.match(source, /canUseHandoffs\s*\?\s*getJSON\("\/handoffs\/inbox"\)/, "inbox is not requested before required consent is confirmed");
assert.match(source, /canUseHandoffs\s*\?\s*getJSON\("\/handoffs\/directory\/recipients"\)/, "recipient discovery is not requested before required consent is confirmed");
assert.match(source, /getJSON\("\/handoffs\/outbox"\)/, "caregivers retain owner access to their outgoing handoff history");
assert.match(source, /consentRequired &&[\s\S]*?\/workspace\/settings/, "caregivers are directed to privacy settings when consent is missing");
assert.match(source, /disabled=\{busy \|\| loading \|\| consentRequired/, "sharing is disabled until consent is confirmed");
console.log("PASS: handoff inbox and recipient discovery are consent-gated; outgoing history remains available.");

const inbox = fs.readFileSync("src/components/mvp-workspace/CaregiverHandoverInbox.tsx", "utf8");
assert.match(inbox, /if \(responsibilities\.status === "fulfilled"\) \{[\s\S]*?setResponsibilityTransfers/,
  "a failed responsibility request must not clear previously loaded responsibility requests");
assert.match(inbox, /if \(primary\.status === "fulfilled"\) \{[\s\S]*?setPrimaryTransfers/,
  "a failed primary-caregiver request must not clear previously loaded requests");
assert.doesNotMatch(inbox, /responsibilities\.status === "fulfilled"[\s\S]*?: \[\]\);/,
  "a failed request must not be converted into an empty list");

assert.match(source, /caregiverSafeGeneratedText\(draft\.warning\)/,
  "generated handoff warnings must use caregiver language");
assert.match(source, /caregiverSafeGeneratedText\(item\.coverage_note\)/,
  "generated handoff coverage notes must use caregiver language");
assert.match(source, /caregiverSafeGeneratedText\(item\.summary \|\| item\.text\)/,
  "generated handoff summaries must use caregiver language");
assert.match(source, /readableEvidenceType\(source\.type \|\| source\.source_type\)/,
  "internal evidence type codes must not be shown in shared summaries");
assert.match(source, /Please check that this summary means the same thing as the saved note/,
  "summary review instructions must explain the check in everyday language");

assert.match(inbox, /setFailedTransferSources\(failed\)/,
  "failed handover sources must be tracked independently so stale requests can be distinguished");
assert.match(inbox, /Some requests shown here could not be refreshed and may be out of date/,
  "previously loaded handovers must be labelled stale when a source refresh fails");
assert.match(inbox, /disabled=\{busy \|\| failedTransferSources\.includes\("primary"\)\}/,
  "primary-caregiver decisions must be disabled when that request list could not be refreshed");
assert.match(inbox, /disabled=\{busy \|\| failedTransferSources\.includes\("responsibility"\)\}/,
  "responsibility decisions must be disabled when that request list could not be refreshed");
