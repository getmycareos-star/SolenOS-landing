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
assert.match(inbox, /if \(responsibilities\.status === "fulfilled" && Array\.isArray\(responsibilities\.value\)\) \{[\s\S]*?setResponsibilityTransfers\([\s\S]*?\} else \{\s*failed\.push\("responsibility"\)/,
  "only a successful responsibility response may replace the saved request list; failures must retain prior rows");
assert.match(inbox, /if \(primary\.status === "fulfilled" && Array\.isArray\(primary\.value\)\) \{[\s\S]*?setPrimaryTransfers\([\s\S]*?\} else \{\s*failed\.push\("primary"\)/,
  "only a successful primary-caregiver response may replace the saved request list; failures must retain prior rows");
assert.match(inbox, /setFailedTransferSources\(failed\)[\s\S]*?if \(failed\.length > 0\)/,
  "partial source failures must remain visible rather than appearing as an empty inbox");
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

assert.match(source, /loadedScopeRef\.current\.caregiverId !== requestCaregiverId[\s\S]*?setInbox\(\[\]\)[\s\S]*?setActiveInbox\(null\)/,
  "handoff inbox and sharing drafts must be cleared when the active caregiver changes");
assert.match(source, /addEventListener\("personIdChanged", refreshForSessionChange\)/,
  "handoff sharing must reload consent and recipient access when the active session changes");
assert.match(source, /const requestSequence = \+\+loadSequenceRef\.current[\s\S]*?if \(!isCurrentRequest\(\)\) return[\s\S]*?if \(isCurrentRequest\(\)\) setLoading\(false\)/,
  "overlapping handoff refreshes must not overwrite the current caregiver's inbox or recipients");

const handoffsPage = fs.readFileSync("src/app/workspace/handoffs/page.tsx", "utf8");
assert.match(handoffsPage, /addEventListener\("personIdChanged", clearDraftForSessionChange\)[\s\S]*?setDraft\(null\)[\s\S]*?setAudience\(null\)[\s\S]*?setPurpose\(null\)/,
  "an open handoff draft must not carry over when the active care recipient or caregiver changes");

assert.match(source, /appointmentOptionsError &&[\s\S]*?We couldn't check saved appointments\. Refresh before preparing an appointment briefing/, "an unavailable appointment list must not be shown as an empty appointment list");
assert.match(source, /!loading && !appointmentOptionsError && appointmentOptions\.length === 0[\s\S]*?No saved appointments are available/, "the no-appointments message must appear only after a successful empty read");
assert.match(source, /preparePurpose === "professional_appointment" && appointmentOptionsError[\s\S]*?return;/, "appointment briefings must not be prepared against an unverified appointment list");

assert.match(inbox, /const requestSequence = \+\+loadSequenceRef\.current[\s\S]*?if \(!isCurrentRequest\(\)\) return[\s\S]*?if \(isCurrentRequest\(\)\) setLoading\(false\)/,
  "handover inbox reads must not let an older caregiver session overwrite the current requests");
assert.match(inbox, /loadedScopeRef\.current !== scopeKey[\s\S]*?setResponsibilityTransfers\(\[\]\)[\s\S]*?setPrimaryTransfers\(\[\]\)/,
  "handover requests from a previous person or caregiver must be cleared when the session changes");
assert.match(inbox, /addEventListener\("personIdChanged", refreshForSessionChange\)/,
  "handover inbox must reload when the active care session changes");
