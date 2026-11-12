import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
assert.equal(isTechnicalDiagnosticText("The provenance reconciliation API returned an assertion payload."), true);
assert.equal(caregiverSafeAssistantText("The OCR extraction pipeline is unavailable."), null);
assert.equal(caregiverSafeAssistantText("Database schema unavailable"), null);
assert.equal(caregiverSafeAssistantText("Your message has been saved. We do not know what caused the change yet."), "Your message has been saved. We do not know what caused the change yet.");
assert.match(caregiverSafeErrorMessage(), /check your connection/i);
assert.equal(caregiverStatusLabel("within_review_window"), "Recently reviewed");
assert.equal(caregiverStatusLabel("needs_confirmation"), "Needs a fresh check");

const dailyCare = readFileSync(new URL("../src/app/workspace/daily-care/page.tsx", import.meta.url), "utf8");
const companion = readFileSync(new URL("../src/components/workflows/AICompanion.tsx", import.meta.url), "utf8");
const documentReview = readFileSync(new URL("../src/components/DocumentIntelligenceReview.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/app/workspace/settings/page.tsx", import.meta.url), "utf8");
const lcr = readFileSync(new URL("../src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", import.meta.url), "utf8");
const appointment = readFileSync(new URL("../src/components/workflows/AppointmentWorkspace.tsx", import.meta.url), "utf8");
const continuity = readFileSync(new URL("../src/components/CareContinuityIntegrityPanel.tsx", import.meta.url), "utf8");
const deviceAccess = readFileSync(new URL("../src/components/mvp-workspace/IdentityDeviceRecoveryPanel.tsx", import.meta.url), "utf8");
const detailedAppointment = readFileSync(new URL("../src/components/workflows/DetailedAppointmentWorkspace.tsx", import.meta.url), "utf8");
const evidenceReview = readFileSync(new URL("../src/components/EvidenceReviewPanel.tsx", import.meta.url), "utf8");
const appointmentPage = readFileSync(new URL("../src/app/workspace/appointments/page.tsx", import.meta.url), "utf8");

assert.doesNotMatch(dailyCare, /epistemic_status\.replace|item\.status\.replace/);
assert.doesNotMatch(dailyCare, /item\.event_type \|\| item\.source_type/);
assert.match(companion, /caregiverSafeAssistantText\(response\.reply\)/);
assert.doesNotMatch(companion, /text: response\.reply/);
assert.doesNotMatch(documentReview, /candidate\.review_status\.replaceAll/);
assert.doesNotMatch(documentReview, /model: \{analysis\.model_provenance\.model_tag/);
assert.doesNotMatch(settings, /setError\(detail \|\|/);
assert.match(settings, /caregiverSafeErrorMessage/);
assert.doesNotMatch(lcr, /Loading care-integrity tools|Loading evidence review|Loading clarification workflow/);
assert.ok(!lcr.includes("cause instanceof Error ? cause.message"));
assert.ok(!appointment.includes("Freshness assessment storage"));
assert.ok(!appointment.includes("source_time_kind:"));
assert.ok(!appointment.includes("cause instanceof Error ? cause.message"));
assert.ok(!appointment.includes("replaceAll('_',"));
assert.ok(!appointment.includes('replaceAll("_",'));
assert.match(appointment, /caregiverStatusLabel/);
assert.ok(!continuity.includes('value.replace(/_/g'));
assert.ok(!deviceAccess.includes("e instanceof Error ? e.message"));
assert.doesNotMatch(deviceAccess, /Identity &amp; device security/);
assert.doesNotMatch(detailedAppointment, /database schema|source_time_kind|Evidence IDs:|Assessment \\{item\\.assessment_id/);
assert.doesNotMatch(detailedAppointment, /error instanceof Error \\? error\\.message/);
assert.doesNotMatch(evidenceReview, /value\\.replaceAll\\('_', ' '\\)/);
assert.doesNotMatch(evidenceReview, /SHA-256|selected\\.origin_device_ref \\|\\|/);
assert.doesNotMatch(appointmentPage, /Appointment workspace/);

console.log("Caregiver language boundary checks passed.");
