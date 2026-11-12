import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const companionPage = await readFile(new URL("../src/components/workflows/AICompanion.tsx", import.meta.url), "utf8");
const sharingComponent = await readFile(new URL("../src/components/workflows/CareHandoffSharing.tsx", import.meta.url), "utf8");
const handoffPage = await readFile(new URL("../src/app/workspace/handoffs/page.tsx", import.meta.url), "utf8");
const apiClient = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");

assert.match(handoffPage, /CareHandoffSharing/,
  "Care Handoffs route must render the persisted handoff workspace");
assert.match(handoffPage, /Care Handoffs/,
  "the handoff route must have its own visible page heading");
assert.match(handoffPage, /onResumeDraft=\{resumeDraft\}/,
  "caregivers must be able to resume a persisted draft from the Handoffs workspace");
assert.doesNotMatch(handoffPage, /href="\/workspace\/companion"/,
  "handoff preparation must not be routed through AI Companion");
assert.doesNotMatch(handoffPage, /redirect\(/,
  "the Handoffs route must not redirect away from its dedicated workspace");

assert.match(companionPage, /postJSON\('\/conversation\/message'/,
  "AI Companion must remain a conversation interface");
assert.doesNotMatch(companionPage, /handoff-drafts|Create care handoff|AppointmentWorkspace|ScanDocumentCapture|SnapCameraCapture/,
  "AI Companion must not own handoff, appointment, or document-intake workflows");

for (const label of ["Prepare a care handoff", "Family caregiver", "Healthcare professional", "Taking over today", "Doctor’s appointment", "Full care overview"]) {
  assert.ok(sharingComponent.includes(label), `Care Handoffs must expose ${label}`);
}
assert.match(sharingComponent, /postJSON\("\/handoff-drafts\/prepare"/,
  "handoff preparation must be performed by the backend from the dedicated workspace");
assert.match(sharingComponent, /X-Request-ID/,
  "draft preparation must reuse a stable request ID across retries");
assert.match(sharingComponent, /generation_status/,
  "the persisted draft response must retain actual generation status");
assert.match(sharingComponent, /validation_status/,
  "the persisted draft response must retain backend grounding validation status");
assert.match(sharingComponent, /source_references/,
  "draft review must expose backend source references");
assert.match(sharingComponent, /Information included and availability/,
  "draft review must expose source availability and missing information");
assert.match(sharingComponent, /onResumeDraft/,
  "caregivers must be able to resume persisted drafts");
assert.match(handoffPage, /savedDraft\.purpose === "professional_appointment" \? "professional" : "family"/,
  "resumed appointment drafts must restore their original audience");

assert.match(sharingComponent, /getJSON\("\/handoff-drafts\?limit=10"\)/,
  "caregiver-owned persisted drafts must be discoverable");
assert.match(sharingComponent, /canUseHandoffs\s*\?\s*getJSON\("\/handoffs\/outbox"\)/,
  "outgoing handoff history must not trigger a 403 before required consent is saved");
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
assert.match(sharingComponent, /Information to share/,
  "caregivers must explicitly select the information categories included in the handoff");
assert.match(sharingComponent, /setSelectedScope\(\[\]\)/,
  "handoff information categories must start unselected and require caregiver choice");
assert.match(sharingComponent, /selectedScope\.length === 0/,
  "sharing must remain blocked until at least one information category is selected");
assert.match(sharingComponent, /scope: \[\.\.\.selectedScope\]\.sort\(\)/,
  "the approved scope must be passed unchanged to the existing share API");
assert.match(sharingComponent, /sourceFreshness\?\.status !== "current"/,
  "stale or unverifiable source snapshots must block sharing");
assert.match(sharingComponent, /revisionHistory\.map/,
  "caregivers must be able to inspect persisted revision history");
assert.match(sharingComponent, /setEditedSections/,
  "caregivers must be able to edit or remove source-grounded sections");
assert.match(sharingComponent, /If a statement is outdated or needs correcting, explain that in the caregiver note below/,
  "caregivers must be able to flag outdated or incorrect information without rewriting sourced evidence");
assert.match(sharingComponent, /Sourced wording stays tied to the saved care record/,
  "the UI must explain why sourced wording is not freely rewritten");
assert.doesNotMatch(sharingComponent, /item\.source_ref} ·/,
  "the caregiver review must not expose raw source identifiers");
assert.doesNotMatch(sharingComponent, /Qwen quotations/,
  "the caregiver interface must not expose internal model terminology");
assert.match(sharingComponent, /Source: record /,
  "the shared summary must use readable source labels instead of internal IDs");
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
assert.match(sharingComponent, /Confirm exactly what will be shared/,
  "final approval must restate the full sharing decision");
assert.match(sharingComponent, /Recipient\(s\):/,
  "final approval must identify selected recipients");
assert.match(sharingComponent, /Information included:/,
  "final approval must identify selected information scope");
assert.match(sharingComponent, /Access ends:/,
  "final approval must restate the expiry");
assert.match(sharingComponent, /activeSnapshot\.purpose && <p style=\{\{ fontSize: 12 \}\}>Purpose: \{handoffPurposeLabel/,
  "incoming handoff must show a caregiver-readable purpose");
assert.match(sharingComponent, /item\.scope\.map\(readableScope\)/,
  "incoming and outgoing scope must use caregiver-readable labels");
assert.doesNotMatch(sharingComponent, /Integrity hash:/,
  "incoming caregiver review must not expose raw integrity hashes");
assert.doesNotMatch(sharingComponent, /item\.original_source_reference \? " · document " \+ item\.original_source_reference/,
  "recipient review must not expose internal document paths or references");
assert.match(sharingComponent, /saved\.review_status \? readableStatus/,
  "saved draft review states must use caregiver-readable labels");
assert.match(sharingComponent, /Source: record /,
  "shared summaries must label sources without exposing database identifiers");
assert.doesNotMatch(sharingComponent, /Qwen/,
  "the caregiver-facing handoff component must not expose model names");
assert.match(sharingComponent, /revoke\(item\)/,
  "the initiating caregiver must retain a revocation path");
assert.doesNotMatch(sharingComponent, /source_record_ids\s*:/,
  "the browser must not manufacture or attest server source provenance");
assert.doesNotMatch(sharingComponent, /putJSON\([^)]*\/summary/,
  "the frontend must not use the legacy detached summary-attachment step");
assert.match(apiClient, /postJSON\(path: string, body: unknown, extraHeaders: Record<string, string> = \{\}/,
  "the API client must pass stable idempotency headers without replaying mutations");

const appointmentWorkspace = await readFile(new URL("../src/components/workflows/AppointmentWorkspace.tsx", import.meta.url), "utf8");
const detailedAppointmentWorkspace = await readFile(new URL("../src/components/workflows/DetailedAppointmentWorkspace.tsx", import.meta.url), "utf8");
assert.ok(appointmentWorkspace.includes("/appointment-workspaces/preparation-brief?window_days=90"), "appointment preparation must request a bounded source-linked LCR brief");
assert.ok(appointmentWorkspace.includes("source_id") && appointmentWorkspace.includes("epistemic_status"), "appointment preparation must display source IDs and epistemic status");
assert.ok(appointmentWorkspace.includes("No recent care events were returned") && appointmentWorkspace.includes("This does not establish that no appointment exists"), "appointment preparation must distinguish empty results from confirmed absence");
assert.ok(appointmentWorkspace.includes("getJSON('/appointment-workspaces')"), "appointment workspace must hydrate durable backend records");
assert.ok(appointmentWorkspace.includes("postJSON('/appointment-workspaces'"), "appointment workspace must create a durable backend record");
assert.ok(appointmentWorkspace.includes("patchJSON('/appointment-workspaces/'"), "appointment workspace must persist edits through the versioned backend API");
assert.match(appointmentWorkspace, /expected_version:\s*record\.version_number/, "appointment saves must use the current persisted record version for optimistic concurrency");
assert.ok(appointmentWorkspace.includes("'/outcome-proposals/' + encodeURIComponent(proposal.id) + '/review'"), "appointment notes must enter the explicit backend caregiver-review workflow before any LCR assertion");
assert.match(appointmentWorkspace, /Accept as caregiver report/, "appointment-derived information must require an explicit caregiver acceptance decision before LCR recording");
assert.match(appointmentWorkspace, /postJSON\('\/appointment-workspaces\/' \+ encodeURIComponent\(record\.id\) \+ '\/outcome-proposals'/, "appointment outcome candidates must be created by the backend");
assert.match(appointmentWorkspace, /outcome-proposals\/' \+ encodeURIComponent\(proposal\.id\) \+ '\/review/, "appointment candidates must use backend review decisions");
assert.match(appointmentWorkspace, /Accept as caregiver report/, "caregiver acceptance must be explicit");
assert.match(appointmentWorkspace, /Save correction/, "caregiver corrections must remain a separate decision");
assert.match(appointmentWorkspace, /Reject/, "caregiver rejection must be available");
assert.match(appointmentWorkspace, /not independently verified/, "appointment assertions must not be presented as clinically verified");
assert.match(appointmentWorkspace, /refreshSavedWorkspace\(\)/, "guided appointment state must reload records saved through detailed controls");
assert.match(appointmentWorkspace, /idempotency_key: requestKey/, "guided appointment notes must retry with a stable idempotency key");
assert.match(detailedAppointmentWorkspace, /idempotency_key: requestKey/, "detailed appointment workspace writes must retry with a stable idempotency key");


assert.match(detailedAppointmentWorkspace, /postJSON\('\/open-loops'/, "appointment follow-up actions must persist through the shared Open Loops API");
assert.match(detailedAppointmentWorkspace, /patchJSON\('\/open-loops\//, "appointment follow-up edits must update their persisted Open Loop");
assert.match(detailedAppointmentWorkspace, /source_type: 'appointment_workspace'/, "follow-up actions must retain their appointment workspace origin");
assert.match(detailedAppointmentWorkspace, /deadline_timezone: item\.due \? Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/, "appointment follow-up deadlines must retain the caregiver local timezone");
assert.match(detailedAppointmentWorkspace, /appointment-follow-up:/, "follow-up creation must use a stable idempotency key");
assert.match(detailedAppointmentWorkspace, /\/outcomes/, "marking a follow-up done must record an attributed outcome event");
assert.match(detailedAppointmentWorkspace, /caregiver-reported outcome, not independently verified/, "caregiver-reported completion must not be treated as verified closure");

console.log("PASS: handoff preparation, saved-draft retrieval, revision, approval, source freshness, existing sharing, acknowledgement, and revocation use the backend as the sole source of truth.");
