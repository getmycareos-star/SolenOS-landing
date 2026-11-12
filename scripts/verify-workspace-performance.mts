import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const landingStartLink = fs.readFileSync("src/components/public/LandingStartLink.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");
const appointmentsPage = fs.readFileSync("src/app/workspace/appointments/page.tsx", "utf8");
const appointment = fs.readFileSync("src/components/workflows/AppointmentWorkspace.tsx", "utf8");

const loadStart = workspace.indexOf("const load = useCallback(async (manual = false) => {");
const loadEnd = workspace.indexOf("const transitionConfirmation = useCallback(async (", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "current-care load lifecycle must remain identifiable");
const initialLoad = workspace.slice(loadStart, loadEnd);
assert.match(initialLoad, /\/care-continuity\/current-care\?limit_per_source=12/, "the person-scoped current-care projection must be the primary LCR request");
assert.ok(
  initialLoad.indexOf("setProjection(currentCare as CurrentCareProjection);") >= 0 &&
  initialLoad.indexOf("setProjection(currentCare as CurrentCareProjection);") < initialLoad.indexOf("setLoading(false);"),
  "first caregiver view must be released immediately after projection validation",
);
assert.match(initialLoad, /Promise\.allSettled\(backgroundTasks\)/, "secondary reads must run concurrently without blocking first paint");
assert.doesNotMatch(initialLoad, /postJSON\(/, "opening the LCR must not trigger automatic reassessment writes");
assert.match(initialLoad, /getJSON\("\/care-continuity\/situation-understanding"\)/, "the last saved assessment must be reused rather than recomputed during initial load");
assert.match(workspace, /const CareContinuityIntegrityPanel = dynamic/, "advanced integrity tools must be code-split");
assert.match(workspace, /const EvidenceReviewPanel = dynamic/, "evidence review must be code-split");
assert.match(workspace, /onToggle=\{\(event\) => setAdvancedPanelsOpen\(event\.currentTarget\.open\)\}/, "advanced review components must mount only after explicit expansion");
assert.match(workspace, /advancedPanelsOpen \? <EvidenceReviewPanel/, "evidence review must not mount before the caregiver expands the source section");
assert.match(workspace, /solenos\.workspace\.first-care-ready/, "first validated care readiness must be measurable");
assert.match(workspace, /solenos\.journey\.landing-to-first-care/, "landing-to-care readiness must be measurable");

assert.doesNotMatch(companion, /AppointmentWorkspace|appointment-workspaces/, "AI Companion must not own or load the appointment workflow");
assert.match(appointmentsPage, /import AppointmentWorkspace/, "the appointment workflow must be owned by its dedicated route");
assert.match(appointmentsPage, /<AppointmentWorkspace \/>/, "the dedicated appointment route must keep the persisted workflow reachable");
assert.match(appointment, /appointment-workspaces/, "appointment workflow must remain connected to its persisted backend resource");

assert.match(shell, /prefetch=\{false\}/, "secondary routes must not prefetch on initial workspace load");
assert.match(shell, /onMouseEnter=\{\(\) => router\.prefetch\(href\)\}/, "navigation may prefetch only after explicit pointer intent");
assert.match(shell, /const ShareCareSummaryPanel = dynamic\(/, "share/export UI must be deferred until opened");
assert.match(shell, /solenos\.workspace\.navigation-to-route-mounted/, "navigation-to-route readiness must be measurable");
assert.match(page, /<LCRCurrentUnderstanding \/>/, "the canonical workspace route must continue to render the LCR");
assert.match(landingStartLink, /solenos\.journey\.landing-cta/, "landing CTA timing must be recorded from a client component");
assert.doesNotMatch(workspace, /sample|demo|placeholder|fake care/i, "performance changes must not introduce fabricated care data");

console.log("PASS: projection-first, read-only LCR hydration");
console.log("PASS: advanced panels and appointment workflow are code-split");
console.log("PASS: intent-based route loading and local readiness timing");
