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
