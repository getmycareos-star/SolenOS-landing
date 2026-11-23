import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const lcrHome = read("src/app/workspace/page.tsx");
const home = read("src/app/workspace/companion/page.tsx");
const dailyCare = read("src/app/workspace/daily-care/page.tsx");
const shell = read("src/components/app-shell/AppShell.tsx");
const navigation = read("src/lib/workspace-navigation.ts");
const moreMenu = read("src/components/mvp-workspace/WorkspaceMoreMenu.tsx");
const history = read("src/components/app-shell/HistoryDrawer.tsx");
const morePage = read("src/app/workspace/more/page.tsx");
const handoverInbox = read("src/components/mvp-workspace/CaregiverHandoverInbox.tsx");
const shellStyles = read("src/app/globals.css");
const addPanel = read("src/components/mvp-workspace/AddSituationPanel.tsx");
const cognitive = read("src/components/mvp-workspace/CognitiveWorkspace.tsx");
const record = read("src/app/workspace/record/page.tsx");

assert.match(home, /@\/components\/workflows\/AICompanion/);
assert.match(home, /solenos-companion-home/);
assert.match(home, /companion-conversation/);
assert.match(home, /conversation|Companion/);
assert.match(home, /<Companion home initialPrompt=\{prompt\} \/>/, "record-edit prompt is passed into the existing Companion composer");
const companion = read("src/components/workflows/AICompanion.tsx");
const documents = read("src/app/workspace/documents/page.tsx");
const documentReview = read("src/components/DocumentIntelligenceReview.tsx");
assert.match(companion, /companion-shell.*is-home/);
assert.match(companion, /SOURCE_REFERENCE_LABELS/, "Companion provenance must use explicit source-reference labels");
assert.match(companion, /document_extractions/, "persisted document extraction references must be presented");
assert.match(companion, /Text read from a document is only a suggestion\. Review it in Documents before it is added to your care record\./, "document text must remain review-only until the caregiver accepts it");
assert.match(companion, /Earlier conversation message.*conversation history, not a care update/, "prior conversation references must be distinguished from care evidence");
assert.match(companion, /source_record_refs/, "the Companion must render the backend's selected source references");
assert.doesNotMatch(companion, /Add to care story/);
assert.doesNotMatch(
  companion,
  /companion-add-menu|Upload document|Snap a photo|Scan document|setPendingDocumentIntake|uploadInputRef|captureInputRef|captureCameraPage|navigator\.mediaDevices/,
  "AI Companion must remain conversational; document capture belongs in Documents",
);
assert.match(companion, /initialPrompt = null/, "Companion accepts a prompt without opening a second entry screen");
assert.match(documents, /uploadInputRef/, "Documents must provide direct file upload");
assert.match(documents, /snapInputRef/, "Documents must provide a direct photo capture option");
assert.match(documents, /capture="environment"/, "photo capture should prefer the rear-facing camera");
assert.match(documents, /navigator\.mediaDevices\?\.getUserMedia/, "multi-page scanning must request a live camera stream");
assert.match(documents, /captureCameraPage/, "multi-page scanning must capture actual camera frames");
assert.match(documents, /finishCameraScan/, "captured pages must be handed to document review");
assert.match(documents, /handleFiles/, "uploaded and captured files must enter the same document preparation workflow");
assert.match(documents, /saveReviewedPages/, "the library retains original-file persistence");
assert.match(documents, /saveReviewedPages/, "the library retains original-file persistence");
assert.match(documents, /Save your files/);
assert.match(documents, /SolenOS will keep reading them even if you leave/, "saving confirms that processing continues after the original upload is complete");
assert.match(documentReview, /documentExtractionIsComplete\(analysis\)\s*\?\s*analysis\.observations\.map/, "document candidates must remain hidden until extraction completeness is verified across all pages");
assert.match(documentReview, /We couldn\'t read every page, so there are no details to review yet/, "caregivers must be told why incomplete documents cannot be reviewed");
assert.match(documents, /saveReviewedPages/);
assert.match(documents, /getJSON\("\/evidence\//, "saved document records remain readable");
assert.match(documents, /getBlob\("\/upload\//, "saved original files remain retrievable");
assert.doesNotMatch(home, /compose=1|CognitiveWorkspace|lcr-add-screen/, "the legacy LCR entry screen is removed from Companion home");
assert.match(dailyCare, /StructuredDailyCapture/);
assert.doesNotMatch(dailyCare, /DailyCareQwen|daily-care\/intelligence\/ask|Ask Daily Care Qwen/);
assert.match(navigation, /WORKSPACE_SECONDARY_NAVIGATION:[\s\S]*?href: "\/workspace\/companion",[\s\S]*?label: "Care Assistant"/, "Care Assistant is available under More");
assert.doesNotMatch(shell, /href: "\/workspace\/record"/);
assert.match(shell, /useState\(false\)/);
assert.match(shell, /is-sidebar-open/);
assert.match(shell, /Open navigation/);
assert.match(shell, /Close navigation/);
assert.doesNotMatch(shell, /Search history|HistoryDrawer/);
assert.match(morePage, /<HistoryDrawer \/>/, "recent history is grouped with secondary tools under More");
assert.doesNotMatch(shell, /MoreVertical|solenos-main-menu/);
assert.doesNotMatch(shell, /Caregiver account/);
assert.match(navigation, /href: "\/workspace\/daily-care"[\s\S]*?label: "Share an update"/);
assert.match(navigation, /href: "\/workspace\/documents"[\s\S]*?label: "Documents"/);
assert.match(navigation, /href: "\/workspace\/handoffs"[\s\S]*?label: "Share care information"/);
assert.match(navigation, /href: "\/workspace\/appointments"[\s\S]*?label: "Appointments"/);
assert.match(shell, /pathname === "\/workspace"/);
assert.match(shell, /<WorkspaceMoreMenu/);
assert.match(shell, /ShareCareSummaryPanel/);
assert.match(shell, /ensureAnonymousSession/);
assert.match(shell, /ensureClientInteractionSessionId/);
assert.doesNotMatch(addPanel, /WorkspaceMoreMenu|ShareCareSummaryPanel/);
assert.doesNotMatch(cognitive, /WorkspaceMoreMenu|handleWorkspaceAction|beforeinstallprompt/);
assert.match(shell, /beforeinstallprompt/);
assert.match(shell, /solenos_last_input_raw/);
assert.match(shell, /solenos_workspace_pinned/);
assert.match(shell, /solenos_workspace_archived/);
assert.match(moreMenu, /label: "Share care summary"/);
assert.match(moreMenu, /label: "Add to Home"/);
assert.match(moreMenu, /label: "Edit record"/);
assert.match(moreMenu, /label: "View record details"/);
assert.match(moreMenu, /label: "Download \/ Export"/);
assert.match(moreMenu, /label: "Archive"/);
assert.match(moreMenu, /label: "Pin"/);
assert.match(moreMenu, /label: "Unpin"/);
assert.match(moreMenu, /label: "Clear this device"/, "the destructive action must say exactly what is cleared rather than implying that saved care information is deleted");
assert.match(shell, /case "share_care_summary"/);
assert.match(shell, /case "download_export"/);
assert.match(shell, /case "add_to_home"/);
assert.match(shell, /case "archive"/);
assert.match(shell, /case "restore"/);
assert.match(shell, /case "pin"/);
assert.match(shell, /case "unpin"/);
assert.match(shell, /case "delete"/);
assert.match(shell, /await revokeAnonymousSession\(\)/, "Delete must revoke the active anonymous device session before clearing local workspace data");
assert.match(shell, /case "edit_record"/);
assert.match(shell, /router\.push\("\/workspace\/daily-care"\)/, "Edit record must open the care update workflow, not paste a generic prompt into Companion");
assert.match(shell, /case "view_record_details"/);
assert.match(shell, /<CareRecordOverview \/>/);
assert.match(shell, /CareRecordOverview/);
assert.doesNotMatch(shell, /LCRCurrentUnderstanding/);
assert.match(read("src/components/app-shell/CareRecordOverview.tsx"), /What is saved/);
assert.match(read("src/components/app-shell/CareRecordOverview.tsx"), /Changes in care over time/);
assert.doesNotMatch(read("src/components/app-shell/CareRecordOverview.tsx"), /LONGITUDINAL RECORD/);
assert.match(shell, /case "download_export"/);
assert.match(shell, /intent={sharePanelIntent}/);
assert.match(shell, /It does not delete care information already saved in SolenOS/i, "workspace deletion must clearly distinguish local device data from saved care information");
assert.match(shell, /getAnonymousAccessToken/);
assert.match(shell, /revokeAnonymousSession/);
assert.doesNotMatch(home, /startInUpdateMode|CognitiveWorkspace/);
assert.match(companion, /You don’t have to figure it all out right now/);
assert.match(companion, /I need to talk it through/);
assert.match(companion, /A few words are enough/);
assert.match(companion, /companion-starter-copy strong \{[^}]*font-size:14px/);
const sharePanel = read("src/components/mvp-workspace/share/ShareCareSummaryPanel.tsx");
const executableSharePanel = sharePanel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
assert.match(executableSharePanel, /CareHandoffSharing/, "the share entry point must use the persisted LCR briefing workflow");
assert.doesNotMatch(executableSharePanel, /generateSummary|selectContentForAudience|\/api\/situation/, "the share entry point must not generate summaries from browser situation state");
assert.match(moreMenu, /id: "add_to_home", label: "Add to Home", icon: Home/);
assert.match(shell, /To add SolenOS to your home screen/);
assert.match(shell, /iPhone or iPad/);
assert.match(moreMenu, /createPortal/);
assert.match(moreMenu, /position: "fixed"/);
assert.match(moreMenu, /window.addEventListener\("scroll", updateMenuPosition, true\)/);
assert.match(moreMenu, /triggerRef.current\?\.contains\(target\)/);
assert.match(moreMenu, /menuRef.current\?\.contains\(target\)/);
assert.match(moreMenu, /aria-label="More care record actions"/);
assert.match(moreMenu, /aria-haspopup="menu"/);
assert.match(moreMenu, /aria-expanded={open}/);
assert.match(moreMenu, /onClick={handleToggle}/);
assert.ok(moreMenu.includes("onClick={() => handleSelect(item.id)}"));
assert.match(moreMenu, /solenos-care-record-actions-menu/);
assert.doesNotMatch(history, /history-action-menu|history-event-menu-trigger|Share care summary|Add to Home|Edit record|View record details|Download \/ Export|Pin to Home|Archive record|Restore record|Delete record|history-detail-actions/);
assert.match(shellStyles, /\.solenos-chat-topbar\{position:relative;z-index:80/);
assert.match(shellStyles, /\.workspace-more-menu \{[^}]*pointer-events: auto/s);
assert.match(shellStyles, /\.workspace-more-menu-trigger \{[^}]*touch-action: manipulation/s);
assert.match(shell, /finally \{\s*setInstallPrompt\(null\)/);
assert.doesNotMatch(moreMenu, /Daily Care|Documents|Share care information|Appointments|Settings/);
assert.doesNotMatch(shell, /MoreVertical|solenos-main-menu/);
assert.match(record, /redirect\("\/workspace"\)/);
assert.doesNotMatch(record, /LCRCurrentUnderstanding|Record timeline|CognitiveWorkspace/);
assert.doesNotMatch(record, /lcr-support-section|AI Companion/);
assert.ok(lcrHome.includes('href="/workspace/daily-care"'), "Daily Care is directly reachable from the Care Record");
assert.match(morePage, /WORKSPACE_SECONDARY_NAVIGATION\.map/, "More renders the secondary care destinations");
assert.match(navigation, /care: \[[\s\S]*?href: "\/workspace\/open-loops"[\s\S]*?label: "Follow-ups"/, "Follow-ups remains a primary care destination");
assert.match(navigation, /href: "\/workspace\/timeline"[\s\S]*?label: "Care history"/, "care history remains available under More");
assert.match(navigation, /href: "\/workspace\/documents"[\s\S]*?label: "Documents"/, "Documents remains available under More");
assert.match(morePage, /WORKSPACE_SECONDARY_NAVIGATION\.map/, "Care Assistant is reachable under More through the shared secondary navigation");
assert.ok(morePage.includes('href="/workspace/timeline">View all care history</Link>'), "Care history is reached from More through its current browsing link");
assert.match(handoverInbox, /ensureAnonymousSession\(\)/, "handover requests wait for a valid caregiver session");
assert.match(handoverInbox, /Promise\.allSettled/, "one unavailable handover list does not hide the other");
assert.match(handoverInbox, /We couldn't check all pending care handovers/);
assert.match(handoverInbox, /Try again/, "a failed handover check can be retried");
assert.match(handoverInbox, /!loading/, "an empty handover list is hidden only after checking finishes");
assert.match(lcrHome, /LCRCurrentUnderstanding/);
assert.doesNotMatch(lcrHome, /companion-conversation/);

console.log("Companion home contract passed: conversation-only Companion, source provenance, Documents-owned upload/photo/scan intake, plain-language care record, caregiver update route, device-session actions, export flow, and browseable history.");


assert.match(companion, /if \(!Array\.isArray\(response\?\.items\)\) throw new Error\(/, "an invalid care-suggestion response must not be treated as an empty list");
assert.match(companion, /setCareUpdateLoadFailed\(true\)/, "failed suggestion reads must be tracked independently from save and review errors");
assert.match(companion, /careUpdateLoadFailed && pendingCareUpdates\.length > 0[\s\S]*?These are the last suggestions we could load\. They may be out of date; refresh before making a decision\./, "previously loaded care suggestions must be labelled stale when refresh fails");

assert.match(companion, /disabled=\{careUpdateLoading \|\| careUpdateLoadFailed \|\| Boolean\(reviewingCareUpdateId\)\}/, "caregiver decisions must be paused while suggestions are loading or stale");

assert.match(companion, /const requestSequence = \+\+careUpdateLoadSequenceRef\.current[\s\S]*?if \(isCurrentRequest\(\)\) \{\s*setPendingCareUpdates\(response\.items\)\s*setCareUpdateLoadFailed\(false\)\s*\}[\s\S]*?if \(isCurrentRequest\(\)\) setCareUpdateLoading\(false\)/, "only the current successful response may replace suggestions, clear the stale flag, or finish loading");

assert.match(companion, /conversationScopeRef\.current !== activeScopeKey[\s\S]*?setMessages\(\[userMsg\]\)[\s\S]*?setPendingCareUpdates\(\[\]\)[\s\S]*?session_id: activeSessionId/, "Companion must clear prior caregiver messages and pending suggestions when the active person or caregiver changes");

assert.match(companion, /const clearPreviousCareScope = \(\) => \{[\s\S]*?setMessages\(\[\]\)[\s\S]*?setSessionId\(null\)[\s\S]*?setPendingCareUpdates\(\[\]\)[\s\S]*?addEventListener\('personIdChanged', clearPreviousCareScope\)/, "Companion must register a care-scope change handler that immediately clears another caregiver's conversation and pending suggestions");


assert.match(companion, /const conversationScopeSequenceRef = useRef\(0\)/,
  "care-scope changes must invalidate in-flight conversation requests");
assert.match(companion, /const requestScopeSequence = conversationScopeSequenceRef\.current[\s\S]*?requestScopeSequence === conversationScopeSequenceRef\.current/,
  "conversation restoration must stop when the active care scope changes while it is loading");
assert.match(companion, /if \(!isCurrentScopeRequest\(\) \|\| activeCompanionConversationStorageKey\(\) !== activeScopeKey\) return/,
  "a response from a previous care scope must never be appended to the current caregiver conversation");
assert.match(companion, /catch \(error\) \{\s*if \(!isCurrentScopeRequest\(\)\) return[\s\S]*?finally \{\s*if \(isCurrentScopeRequest\(\)\) setLoading\(false\)/,
  "late failures and completion handlers must not overwrite the active caregiver's conversation state");
