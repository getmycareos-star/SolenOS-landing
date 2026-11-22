import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/accessibility/GlobalDisplayPreferences.tsx",
  "utf8",
);
const baseStyles = readFileSync("src/app/workspace/experience-design-system.css", "utf8");
const v2Styles = readFileSync("src/app/workspace/experience-design-system-v2.css", "utf8");
const navigationStyles = readFileSync("src/app/workspace/navigation-accessibility.css", "utf8");
const accessibilityStyles = readFileSync("src/app/accessibility-overrides.css", "utf8");

assert.match(source, /const DEFAULTS: Preferences = \{ theme: "light", scale: "100" \}/);
assert.match(source, /saved\.theme === "system" \? \{ \.\.\.saved, theme: "light" \} : saved/);
assert.match(source, /window\.matchMedia\("\(prefers-color-scheme: dark\)"\)/);
assert.match(source, /prefs\.theme === "system" \? \(systemTheme\.matches \? "dark" : "light"\) : prefs\.theme/);
assert.match(source, /systemTheme\.addEventListener\("change", applyTheme\)/);
assert.match(source, /systemTheme\.removeEventListener\("change", applyTheme\)/);
assert.match(source, /root\.style\.colorScheme = resolvedTheme/);
assert.match(source, /root\.style\.setProperty\("--solenos-text-scale"/);
assert.match(baseStyles, /font-size:\s*calc\(15px \* var\(--solenos-text-scale, 1\)\)/,
  "the workspace base text size must respond to the saved large-text preference");
assert.match(v2Styles, /font-size:\s*calc\([^;]+\* var\(--solenos-text-scale, 1\)\)/,
  "the caregiver design layer must scale its fixed-size typography");
assert.match(accessibilityStyles, /font-size:\s*calc\(16px \* var\(--solenos-text-scale, 1\)\)/,
  "the document root must keep rem-based text in sync with the selected scale");
for (const [name, stylesheet] of [
  ["workspace base", baseStyles],
  ["workspace v2", v2Styles],
  ["navigation", navigationStyles],
  ["accessibility", accessibilityStyles],
] as const) {
  assert.doesNotMatch(stylesheet, /font-size:\s*(?:\d+(?:\.\d+)?px|clamp\()/i,
    `${name} must not leave fixed pixel typography outside the display scale`);
}
const inlineTypographyPaths = [
  "src/components/ui/RecordState.tsx",
  "src/components/trust/CorrectThis.tsx",
  "src/components/trust/AIAttribution.tsx",
  "src/components/trust/ReportProblem.tsx",
  "src/components/trust/SourceIndicator.tsx",
  "src/components/trust/WhyAmISeeingThis.tsx",
  "src/components/trust/InformationStatus.tsx",
  "src/components/ConflictResolutionPanel.tsx",
  "src/components/CareContinuityIntegrityPanel.tsx",
  "src/components/ClaimAssessmentPanel.tsx",
  "src/components/ClarificationWorkflowPanel.tsx",
  "src/components/EvidenceReviewPanel.tsx",
  "src/components/DocumentIntelligenceReview.tsx",
  "src/components/workflows/CaptureAnalysisReview.tsx",
  "src/components/workflows/QuickDailyCheckIn.tsx",
  "src/components/mvp-workspace/CaregiverHandoverInbox.tsx",
  "src/components/workflows/CareHandoffSharing.tsx",
  "src/components/workflows/DailyCarePhotoCapture.tsx",
  "src/components/mvp-workspace/CaregiverAccessPanel.tsx",
  "src/components/mvp-workspace/AddSituationPanel.tsx",
  "src/components/workflows/StructuredDailyCapture.tsx",
  "src/components/workflows/NaturalLanguageDailyUpdate.tsx",
  "src/components/mvp-workspace/capture/ScanDocumentCapture.tsx",
  "src/app/workspace/documents/page.tsx",
  "src/app/workspace/care-continuity/page.tsx",
  "src/components/mvp-workspace/share/ShareCareSummaryPanel.tsx",
  "src/lib/permissions/PermissionExplainer.tsx",
];
for (const path of inlineTypographyPaths) {
  const component = readFileSync(path, "utf8");
  assert.doesNotMatch(component, /fontSize:\s*(?:\d+(?:\.\d+)?|["'](?:\d+(?:\.\d+)?px|clamp\())/,
    `${path} must apply the saved text scale to inline pixel font sizes`);
}
assert.match(source, /setSaveState\("saved"\)/);
assert.match(source, /setSaveState\("session-only"\)/);
assert.match(source, /could not be saved on this device/);
assert.doesNotMatch(source, /System default intentionally means the accessible light theme/);

console.log("Display preference contract passed: explicit themes, live OS theme changes, cleanup, native color-scheme, and text scaling.");
