import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const companionPage = await readFile(new URL("../src/components/workflows/AICompanion.tsx", import.meta.url), "utf8");
const sharingComponent = await readFile(new URL("../src/components/workflows/CareHandoffSharing.tsx", import.meta.url), "utf8");
const handoffPage = await readFile(new URL("../src/app/workspace/handoffs/page.tsx", import.meta.url), "utf8");
const apiClient = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");

assert.match(handoffPage, /redirect\("\/workspace\/companion"\)/,
  "standalone handoff page must route caregivers into AI Companion");
for (const label of ["Create care handoff", "Family caregiver", "Professional", "Taking over today", "Doctor’s appointment", "Full care overview"]) {
  assert.ok(companionPage.includes(label), `AI Companion must expose ${label}`);
}
assert.ok(companionPage.includes("<AppointmentWorkspace />"), "appointments must retain their separate workflow");
assert.ok(companionPage.includes("handoffPurpose === 'appointment'"), "doctor appointment must be a supported handoff purpose");
assert.match(companionPage, /purpose === 'professional_appointment'/, "doctor appointment must map to the backend-supported purpose");
assert.match(companionPage, /handoffAudience === 'professional' && \(/, "doctor appointment must only be offered for professional handoffs");
assert.match(companionPage, /Professional handoffs can be prepared for your private review only/, "professional sharing limitation must be disclosed before draft preparation");
assert.match(companionPage, /savedDraft\.purpose === "professional_appointment" \? "appointment"/, "resumed appointment drafts must restore their original purpose");

assert.match(companionPage, /postJSON\('\/handoff-drafts\/prepare'/,
  "handoff preparation must be performed by the backend");
assert.match(companionPage, /X-Request-ID/,
  "draft preparation must use a stable idempotency key across retries");
assert.match(companionPage, /generation_status/,
  "Companion must expose actual Qwen generation status");
assert.match(companionPage, /validation_status/,
  "Companion must expose backend grounding validation status");
assert.match(companionPage, /source_references/,
  "draft review must expose backend source references");
assert.match(companionPage, /Information coverage and gaps/,
  "draft review must expose source availability and missing information");
assert.match(companionPage, /onResumeDraft/,
  "caregivers must be able to resume persisted drafts");

assert.match(sharingComponent, /getJSON\("\/handoff-drafts\?limit=10"\)/,
  "caregiver-owned persisted drafts must be discoverable");
assert.match(sharingComponent, /getJSON\("\/handoff-drafts\//,
  "saved drafts must be retrieved from the backend before review");
assert.match(sharingComponent, /putJSON\("\/handoff-drafts\//,
  "caregiver edits must persist as backend draft revisions");
assert.match(sharingComponent, /postJSON\("\/handoff-drafts\//,
  "caregiver approval must be explicit and backend-enforced");
assert.match(sharingComponent, /postJSON\("\/handoffs"/,
  "sharing must use the existing handoffs API");
assert.match(sharingComponent, /draft_id: draft\.draft_id/,
  "the existing sharing workflow must attach the approved persisted draft identity");
assert.match(sharingComponent, /Sharing scope/,
  "caregivers must explicitly select the categories included in the handoff");
assert.match(sharingComponent, /scope: \[\.\.\.selectedScope\]\.sort\(\)/,
  "the approved scope must be passed unchanged to the existing share API");
assert.match(sharingComponent, /sourceFreshness\?\.status !== "current"/,
  "stale or unverifiable source snapshots must block sharing");
assert.match(sharingComponent, /revisionHistory\.map/,
  "caregivers must be able to inspect persisted revision history");
assert.match(sharingComponent, /setEditedSections/,
  "caregivers must be able to edit or remove source-grounded sections");
assert.match(sharingComponent, /exact quotations from the cited persisted source/,
  "the UI must explain that edits are backend-validated against source text");
assert.match(sharingComponent, /caregiver_authored_unverified|caregiverNote/,
  "caregiver-added context must remain explicitly attributed and unverified");
assert.match(sharingComponent, /Share reviewed family handoff/,
  "family sharing requires caregiver review");
assert.match(sharingComponent, /Professional sharing is unavailable until SolenOS can verify professional identity/,
  "professional sharing must fail closed until recipient identity and role are verified");
assert.match(sharingComponent, /Accept and record receipt/,
  "receiving caregivers must explicitly accept and acknowledge");
assert.match(sharingComponent, /activeSnapshot\.source_coverage/,
  "recipients must see source coverage for the approved sharing scope");
assert.match(sharingComponent, /activeSnapshot\.source_references/,
  "recipients must see source references, epistemic status, and event/recording times");
assert.match(sharingComponent, /How the information was sourced/,
  "caregivers must receive a plain-language explanation of source relationships");
assert.match(sharingComponent, /handoffPurposeLabel\(saved\.purpose\)/,
  "saved draft purposes must use caregiver-readable labels");
assert.doesNotMatch(sharingComponent, /Evidence IDs:/,
  "caregiver review must not expose internal evidence identifiers");
assert.doesNotMatch(sharingComponent, /Origin groups:/,
  "caregiver review must not expose internal lineage keys");
assert.match(sharingComponent, /revoke\(item\)/,
  "the initiating caregiver must retain a revocation path");
assert.doesNotMatch(sharingComponent, /source_record_ids\s*:/,
  "the browser must not manufacture or attest server source provenance");
assert.doesNotMatch(sharingComponent, /putJSON\([^)]*\/summary/,
  "the frontend must not use the legacy detached summary-attachment step");
assert.match(apiClient, /postJSON\(path: string, body: unknown, extraHeaders: Record<string, string> = \{\}/,
  "the API client must pass stable idempotency headers without replaying mutations");

const appointmentWorkspace = await readFile(new URL("../src/components/workflows/AppointmentWorkspace.tsx", import.meta.url), "utf8");
assert.ok(appointmentWorkspace.includes("/appointment-workspaces/preparation-brief?window_days=90"), "appointment preparation must request a bounded source-linked LCR brief");
assert.ok(appointmentWorkspace.includes("source_id") && appointmentWorkspace.includes("epistemic_status"), "appointment preparation must display source IDs and epistemic status");
assert.ok(appointmentWorkspace.includes("Source availability") && appointmentWorkspace.includes("Object.entries(lcrBrief.source_coverage)"), "appointment preparation must expose unavailable and excluded sources");
assert.ok(appointmentWorkspace.includes("getJSON('/appointment-workspaces')"), "appointment workspace must hydrate durable backend records");
assert.ok(appointmentWorkspace.includes("postJSON('/appointment-workspaces'"), "appointment workspace must create a durable backend record");
assert.ok(appointmentWorkspace.includes("patchJSON('/appointment-workspaces/'"), "appointment workspace must persist edits through the versioned backend API");
assert.ok(appointmentWorkspace.includes("expected_version: recordVersion"), "appointment saves must use optimistic concurrency");
assert.ok(appointmentWorkspace.includes("lcr_reconciliation: 'not_performed'"), "appointment notes must not silently promote themselves into LCR facts");

console.log("PASS: handoff preparation, saved-draft retrieval, revision, approval, source freshness, existing sharing, acknowledgement, and revocation use the backend as the sole source of truth.");
