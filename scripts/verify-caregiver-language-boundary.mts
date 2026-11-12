import "node:assert/strict";
import {
  caregiverInformationLabel,
  caregiverSafeAssistantText,
  caregiverSafeErrorMessage,
  caregiverStatusLabel,
  isTechnicalDiagnosticText,
} from "../src/lib/caregiver-language";

assert.equal(caregiverStatusLabel("needs_clarification"), "Needs clarification");
assert.equal(caregiverStatusLabel("completed"), "Completed");
assert.equal(caregiverStatusLabel("future_internal_state"), null);
assert.equal(caregiverInformationLabel("reported"), "Caregiver report");
assert.equal(caregiverInformationLabel("epistemic_unknown"), null);

assert.equal(isTechnicalDiagnosticText("Database schema unavailable"), true);
assert.equal(isTechnicalDiagnosticText("Freshness assessment storage is unavailable in this schema."), true);
assert.equal(caregiverSafeAssistantText("Database schema unavailable"), null);
assert.equal(caregiverSafeAssistantText("Your message has been saved. We do not know what caused the change yet."), "Your message has been saved. We do not know what caused the change yet.");
assert.match(caregiverSafeErrorMessage(), /temporarily unavailable/i);

console.log("Caregiver language boundary checks passed.");
