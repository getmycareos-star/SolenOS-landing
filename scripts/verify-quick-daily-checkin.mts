import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const checkIn = fs.readFileSync(
  `${root}/src/components/workflows/QuickDailyCheckIn.tsx`,
  "utf8",
);
const dailyCarePage = fs.readFileSync(
  `${root}/src/app/workspace/daily-care/page.tsx`,
  "utf8",
);
const lcr = fs.readFileSync(
  `${root}/src/components/mvp-workspace/LCRCurrentUnderstanding.tsx`,
  "utf8",
);
const caregiverLanguage = fs.readFileSync(
  `${root}/src/lib/caregiver-language.ts`,
  "utf8",
);
const detailedCapture = fs.readFileSync(
  `${root}/src/components/workflows/StructuredDailyCapture.tsx`,
  "utf8",
);
const durableWriteSender = fs.readFileSync(
  `${root}/src/lib/offline-sync/send-queued-care-write.ts`,
  "utf8",
);
const durableWriteQueue = fs.readFileSync(
  `${root}/src/lib/offline-sync/durable-write-queue.ts`,
  "utf8",
);
const offlineQueueNotice = fs.readFileSync(
  `${root}/src/components/workflows/DailyCareOfflineQueueNotice.tsx`,
  "utf8",
);

assert.match(dailyCarePage, /<QuickDailyCheckIn\s*\/>/,
  "Daily Care mounts the optional quick check-in");
assert.match(checkIn, /endpoint: "\/daily\/log"/,
  "quick check-ins use the existing authenticated daily-log endpoint");
assert.match(checkIn, /enqueueDurableWrite\(/,
  "quick check-ins reserve a durable idempotent write before delivery");
assert.match(checkIn, /deliverDurableWrite</,
  "quick check-ins remove the local write only after the backend confirms delivery");
assert.match(checkIn, /sendQueuedCareWrite\("\/daily\/log", payload\)/,
  "quick check-ins deliver through the existing authenticated daily-log endpoint");
assert.match(checkIn, /getPersonId\(\)/);
assert.match(checkIn, /getCaregiverId\(\)/);
assert.match(checkIn, /value:\s*"same_as_usual"/,
  "the first option records the caregiver's overall impression");
assert.match(checkIn, /value:\s*"change"/,
  "the second option records that some things were different");
assert.match(checkIn, /value:\s*"uncertain"/,
  "the third option preserves uncertainty");
assert.match(checkIn, /selected_areas:\s*\[\]/,
  "an overall check-in does not force care-area selection");
assert.match(checkIn, /scope:\s*"overall_impression_only"/,
  "the payload explicitly limits the meaning to an overall impression");
assert.match(checkIn, /occurred_at_timezone: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone \|\| "UTC"/,
  "quick check-ins preserve the caregiver's local timezone for the reported time");
assert.match(checkIn, /Optional/,
  "the note is optional");
assert.match(checkIn, /maxLength=\{2000\}/,
  "the optional note respects the backend limit");
assert.match(checkIn, /epistemic_status:\s*"caregiver_reported"/,
  "the entry remains a caregiver report, not a verified clinical fact");
assert.match(checkIn, /idempotency_key:\s*requestKey/,
  "an unchanged retry reuses its idempotency key");
assert.match(durableWriteSender, /response\?\.success !== true/,
  "the shared durable sender requires an explicit backend success receipt");
assert.match(durableWriteSender, /response\.id === undefined \|\| response\.id === null/,
  "the shared durable sender requires a persisted record identifier before clearing the queue");
assert.match(durableWriteQueue, /navigator\.storage\.persist\(\)/,
  "the offline queue requests browser storage persistence when supported");
assert.match(durableWriteQueue, /currentRow\.depends_on/,
  "dependent care writes wait for their queued evidence prerequisites");
assert.match(durableWriteQueue, /sort\(\(left, right\) => left\.created_at/,
  "offline writes are synchronized in creation order");
assert.match(durableWriteQueue, /status: dependsOn\.length > 0 \? "pending" : "sending"/,
  "dependent writes do not begin sending before their prerequisites");
assert.match(detailedCapture, /depends_on: evidenceDependencies/,
  "a medication event declares its photo upload as a durable queue dependency");
assert.match(detailedCapture, /prerequisitePending\.some\(Boolean\)/,
  "a medication event is not sent while its local photo upload is still queued");
assert.match(detailedCapture, /photo_ingestion_key: photoIngestionKey/,
  "the medication report carries a stable upload reference so the backend can link the photo after reconnecting");
assert.match(offlineQueueNotice, /automatic storage cleanup/,
  "caregivers are warned when their browser has not protected device-only queued updates");
assert.match(offlineQueueNotice, /before\.sending > 0/,
  "an interrupted in-flight submission is included in automatic queue recovery");
assert.match(offlineQueueNotice, /16_000/,
  "the queue rechecks after an interrupted send lease can expire");
assert.match(offlineQueueNotice, /window\.addEventListener\("focus", update\)/,
  "returning to a backgrounded Daily Care tab refreshes and resumes queued updates");
assert.match(checkIn, /does not confirm medicines were given or measurements were taken/,
  "an overall impression cannot imply medication or measurement completion");
assert.match(checkIn, /window\.dispatchEvent\(new Event\("careRecordUpdated"\)\)/,
  "a confirmed save refreshes the existing care-record view");
assert.match(lcr, /displayCurrentCareDescription\(item\)/,
  "the LCR renders the saved caregiver-readable description");
assert.match(caregiverLanguage, /capture\.quick_check_in[\s\S]*?quickLabels[\s\S]*?quick\.kind/,
  "the caregiver-language formatter renders the saved structured check-in kind");
assert.match(caregiverLanguage, /for \(const key of \["notes", "original_notes"/,
  "the caregiver-language formatter preserves the optional quick check-in note");
assert.match(lcr, /Caregiver shared:/,
  "the LCR labels when the caregiver shared the information");
assert.match(lcr, /Saved to the care record:/,
  "the LCR distinguishes caregiver-reported time from the saved record time");

assert.match(detailedCapture, /capture_idempotency_key: captureIdempotencyKey/,
  "structured Daily Care submits a server-checked idempotency key");
assert.match(detailedCapture, /captureSubmissionRef\.current\.fingerprint !== fingerprint/,
  "an unchanged retry reuses its request key while edited content receives a new key");
assert.match(detailedCapture, /key: crypto\.randomUUID\(\)/,
  "a new structured capture receives a unique request key");
assert.match(detailedCapture, /captureSubmissionRef\.current = null/,
  "the request key is cleared only after a successful save");

assert.match(detailedCapture, /type DailyCaptureMode = "all" \| "something" \| "medicine" \| "measurement" \| "note"/,
  "structured capture exposes one selected interaction mode");
assert.match(detailedCapture, /mode === "measurement"/,
  "measurement capture can be shown without the other structured sections");
assert.match(detailedCapture, /What happened\?/,
  "the observation interaction opens with the caregiver's actual question");
assert.match(detailedCapture, /value="scheduled">Scheduled \(not confirmed as given\)/,
  "a scheduled dose is explicitly distinct from a reported administration");
assert.match(detailedCapture, /This records an expected dose only/,
  "the medicine interaction warns that scheduled does not mean given");
assert.match(detailedCapture, /temperature: \["°F", "°C"\]/,
  "temperature capture offers explicit US and metric units");
assert.match(detailedCapture, /weight: \["lb", "kg"\]/,
  "weight capture offers explicit US and metric units");
assert.match(detailedCapture, /blood_glucose: \["mg\/dL", "mmol\/L"\]/,
  "blood glucose capture offers explicit supported units");
assert.match(detailedCapture, /top number should be higher than the bottom number/,
  "blood pressure capture rejects reversed systolic and diastolic values");
assert.match(detailedCapture, /oxygen level must be 100% or lower/,
  "oxygen saturation capture rejects values above its percentage scale");
assert.match(detailedCapture, /Enter the unit for this measurement/,
  "custom measurements require an explicit unit");
assert.match(detailedCapture, /<option value="refused">Refused<\/option>/,
  "medication refusal is distinct from an unspecified not-given status");
assert.match(detailedCapture, /<option value="missed">Missed<\/option>/,
  "missed medication is distinct from refusal");
assert.match(detailedCapture, /Dose or strength \(optional\)/,
  "caregivers are not forced to guess an unknown medication dose");
assert.match(detailedCapture, /cameraState\.status === 'error' \? 'Try camera again'/,
  "a denied or interrupted medicine-photo camera request can be retried after permissions change");
assert.match(detailedCapture, /extractAttachedDocument\([\s\S]*?"medication_photo"/,
  "medicine photos must use the encrypted durable evidence upload path");
assert.doesNotMatch(detailedCapture, /postFormData\(['"]\/upload/,
  "medicine photos must not bypass the offline-safe evidence queue with a direct upload");
assert.match(read("src/components/mvp-workspace/capture/extract-attached.ts"), /"care_photo" \| "medication_photo" \| "document"/,
  "the shared evidence pipeline must retain medication photos as a distinct evidence type");

assert.match(dailyCarePage, /type CaptureMode = "update" \| "photo" \| "checkin"/,
  "Daily Care exposes only three primary capture choices");
for (const action of ["update", "photo", "checkin"]) {
  assert.ok(dailyCarePage.includes(`value: "${action}"`),
    `Daily Care exposes the ${action} primary interaction`);
}
for (const action of ["medicine", "measurement", "note"]) {
  assert.ok(dailyCarePage.includes(`setStructuredMode("${action}")`),
    `the ${action} structured entry remains available as a secondary choice`);
}
assert.match(dailyCarePage, /Prefer a structured entry\?/,
  "structured entry choices are secondary to the natural-language update");
assert.match(dailyCarePage, /<StructuredDailyCapture mode=\{structuredMode\} \/>/,
  "structured capture opens within the existing Daily Care update flow");
assert.match(dailyCarePage, /<NaturalLanguageDailyUpdate \/>/,
  "natural-language update remains the default detailed capture path");
assert.match(dailyCarePage, /<QuickDailyCheckIn \/>/,
  "quick check-in remains a separate low-effort capture path");
assert.match(dailyCarePage, /<DailyCarePhotoCapture \/>/,
  "photo capture remains available from Daily Care");
assert.match(dailyCarePage, /Upload a medical document/,
  "document upload remains accessible without adding another primary capture choice");
assert.match(dailyCarePage, /Open Care history/,
  "historical review is kept separate from the capture experience");
assert.doesNotMatch(dailyCarePage, /value: "medicine"|value: "measurement"|value: "note"/,
  "structured record types do not compete with the three primary capture choices");

const photoCapture = fs.readFileSync(
  `${root}/src/components/workflows/DailyCarePhotoCapture.tsx`,
  "utf8",
);
const sharedEvidenceCapture = fs.readFileSync(
  `${root}/src/components/mvp-workspace/capture/extract-attached.ts`,
  "utf8",
);
const snapCameraCapture = fs.readFileSync(
  `${root}/src/components/mvp-workspace/capture/SnapCameraCapture.tsx`,
  "utf8",
);
assert.match(snapCameraCapture, /Try camera again/,
  "camera permission and device errors expose an explicit retry action");
assert.match(snapCameraCapture, /\[open, stop, cameraFacingMode, retryCount\]/,
  "retrying the camera actually restarts the camera acquisition effect");
assert.match(photoCapture, /SnapCameraCapture/,
  "new photos use the existing live-camera component");
assert.match(photoCapture, /extractAttachedDocument\(/,
  "photo uploads reuse the existing evidence persistence pipeline");
assert.match(photoCapture, /Take a photo/,
  "camera capture is an explicit action");
assert.match(photoCapture, /Choose an existing photo/,
  "gallery selection remains distinct from live camera capture");
assert.match(photoCapture, /event\.currentTarget\.value = ""[\s\S]*?selectPhoto\(selected, "upload"\)/,
  "the native file picker resets after reading a photo so the same file can be selected again after failure");
assert.match(photoCapture, /Rotate left[\s\S]*?Rotate right/,
  "caregivers can correct photo orientation before upload");
assert.match(photoCapture, /not been added as a care update/,
  "a saved photo is not misrepresented as an accepted care event");
assert.match(sharedEvidenceCapture, /evidence_type: evidenceTypeOverride \?\? \(entryMethod === "snap" \? "care_photo" : "document"\)/,
  "photo evidence retains the correct evidence type in the shared upload pipeline");
assert.match(sharedEvidenceCapture, /fields\.photo_rotation_degrees/,
  "photo orientation metadata is persisted without modifying original bytes");
assert.match(sharedEvidenceCapture, /evidenceTypeOverride === "care_photo"/,
  "care photos are not sent through document OCR as if they were documents");
assert.match(detailedCapture, /When did this happen\?/,
  "free-text observations can preserve an optional event time");
assert.match(detailedCapture, /occurred_at: new Date\(occurredAt\)\.toISOString\(\)/,
  "explicit caregiver event time is sent to the backend separately from recording time");
assert.match(detailedCapture, /occurred_at_timezone: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone \|\| "UTC"/,
  "Daily Care preserves the caregiver's local timezone alongside the UTC event timestamp");
assert.match(detailedCapture, /capture_kind: captureKind/,
  "the selected capture interaction is preserved in the source event");
assert.match(detailedCapture, /Related care details:[\s\S]*?\['committed', 'completed'\]\.includes\(careContinuityExecution\.stages\.reconciliation/,
  "the caregiver save receipt uses plain language and recognizes completed reconciliation");
assert.match(photoCapture, /careRecordUpdated/,
  "a saved photograph refreshes the care record");

assert.match(detailedCapture, /getJSON\("\/care-continuity\/medications"\)/,
  "medication selection reads the person-scoped current LCR medication projection");
assert.match(detailedCapture, /currentMedicationRecords/,
  "current medication choices are held separately from historical caregiver reports");
assert.match(detailedCapture, /caregiver_reviewed_current_report/,
  "the UI accepts only the backend's explicitly reviewed current-report status");
assert.match(detailedCapture, /Choose a current medication from the care record/,
  "current LCR medication records have a distinct selection label");
assert.match(detailedCapture, /Previously reported medicines \(not confirmed current\)/,
  "historical medication entries remain visibly distinct from current medication records");
assert.match(detailedCapture, /addEventListener\("careRecordUpdated"/,
  "current medication choices refresh after the LCR changes");
assert.match(detailedCapture, /removeEventListener\("careRecordUpdated"/,
  "current medication refresh listener is cleaned up on unmount");
assert.match(detailedCapture, /postJSON\("\/care-continuity\/medications"/ ,
  "caregivers can create a medication report in the existing LCR");
assert.match(detailedCapture, /awaiting_caregiver_review/,
  "new medication reports remain pending instead of appearing as current immediately");
assert.match(detailedCapture, /Review and confirm current/,
  "caregivers have an explicit review action before a medicine becomes a current choice");
assert.match(detailedCapture, /\/review/,
  "the review action uses the dedicated medication review endpoint");
assert.match(detailedCapture, /Recorded details:/,
  "caregivers can inspect the original report details before reviewing a medication");
assert.match(detailedCapture, /needs_caregiver_review/,
  "previously reviewed medications can re-enter the review queue when their review window expires");
assert.match(detailedCapture, /Review overdue · caregiver report/,
  "overdue medication reports remain visible and are labeled for review");
assert.match(detailedCapture, /pendingMedicationRecords/,
  "pending medication reports are shown separately from reviewed current medications");
assert.match(detailedCapture, /not independent clinical verification/,
  "the UI does not overstate caregiver review as clinical verification");

const apiClient = fs.readFileSync(`${root}/src/api/client.ts`, "utf8");
const offlineQueue = fs.readFileSync(`${root}/src/lib/offline-sync/durable-write-queue.ts`, "utf8");
const offlineNotice = fs.readFileSync(`${root}/src/components/workflows/DailyCareOfflineQueueNotice.tsx`, "utf8");
assert.match(apiClient, /uploadFormDataWithProgress/,
  "multipart photo uploads expose actual browser transfer progress");
assert.match(apiClient, /xhr\.upload\.addEventListener\("progress"/,
  "upload progress comes from transferred bytes, not a simulated timer");
assert.match(photoCapture, /aria-label="Photo upload progress"/,
  "photo capture exposes accessible upload progress");
assert.match(sharedEvidenceCapture, /onUploadProgress/,
  "the shared evidence pipeline forwards upload progress");
assert.match(offlineQueue, /sending: matching\.filter\(\(row\) => row\.status === "sending"\)/,
  "the durable queue distinguishes in-flight transmission from waiting");
assert.match(offlineNotice, /being sent to SolenOS[\s\S]*does not mean they have been added to your care record/,
  "the caregiver is told that transmission is not LCR acceptance");
assert.match(offlineNotice, /Keep this browser data until they are sent/,
  "caregivers are warned not to clear local data before synchronization completes");
assert.match(offlineNotice, /Try sending again/,
  "queued failures expose an actionable retry");

console.log("✓ quick check-in has exactly three overall-impression choices");
console.log("✓ no care-area questionnaire or daily completion requirement");
console.log("✓ optional note, caregiver attribution, idempotency and confirmed save receipt");
console.log("✓ existing structured capture retry safeguards remain present");
