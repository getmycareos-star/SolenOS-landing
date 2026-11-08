import assert from "node:assert/strict";
import fs from "node:fs";

const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const landing = fs.readFileSync("src/app/page.tsx", "utf8");
const landingCss = fs.readFileSync("src/app/landing.css", "utf8");
const lazyBackground = fs.readFileSync("src/components/public/LazyBackground.tsx", "utf8");
const workspace = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const history = fs.readFileSync("src/components/app-shell/HistoryDrawer.tsx", "utf8");

const projectionRequest = lcr.indexOf('await getJSON("/care-continuity/current-care?limit_per_source=12")');
const firstReady = lcr.indexOf("setLoading(false)", projectionRequest);
const backgroundActions = lcr.indexOf('getJSON(`/registered-actions/', projectionRequest);
const backgroundTasks = lcr.indexOf("void (async () => {", projectionRequest);

assert.ok(projectionRequest >= 0, "the current-care projection remains the authoritative first-screen read");
assert.ok(firstReady > projectionRequest, "the caregiver first screen is released after validating the current-care projection");
assert.ok(backgroundTasks > firstReady, "secondary continuity work starts only after the first-care ready point");
assert.ok(lcr.includes("window.requestAnimationFrame(() => window.setTimeout(loadSecondarySections, 0))"), "secondary API traffic waits until after the browser has had a frame to paint the primary care view");
assert.ok(backgroundActions > firstReady, "registered actions no longer block the first caregiver screen");
assert.ok(lcr.includes('performance.measure("solenos.workspace.first-care-ready"'), "first-care readiness has a local browser performance measurement");
assert.ok(lcr.includes('dynamic(() => import("@/components/CareContinuityIntegrityPanel"))'), "advanced integrity code is split into an on-demand chunk");
assert.ok(lcr.includes('dynamic(() => import("@/components/EvidenceReviewPanel"))'), "evidence review code is split into an on-demand chunk");
assert.ok(lcr.includes("onToggle={(event) => setAdvancedIntegrityOpen(event.currentTarget.open)}"), "advanced integrity panels mount only after the caregiver opens the section");
assert.ok(lcr.includes("{advancedIntegrityOpen && ("), "collapsed advanced panels do not mount and issue background API requests");

assert.ok((shell.match(/prefetch={false}/g) || []).length >= 2, "secondary workspace navigation must not prefetch every route bundle on initial load");
assert.ok(shell.includes('dynamic(() => import("@/components/app-shell/HistoryDrawer")'), "the 52 KB history interface is not part of the initial workspace bundle");
assert.ok(shell.includes("{historyMounted && ("), "history data requests do not start until the caregiver opens history or search");
assert.ok(history.includes("if (eventReadProblem || !eventItems || eventItems.length === 0)"), "history does not repeat the expensive full LCR projection when the dedicated event read succeeds");
assert.ok(shell.includes('dynamic(() => import("@/components/mvp-workspace/share/ShareCareSummaryPanel")'), "the share/export workflow is loaded only when requested");
assert.ok(shell.includes("onTouchStart={() => router.prefetch(href)}"), "mobile navigation intent starts route prefetch before navigation");
assert.ok(shell.includes("onMouseEnter={() => router.prefetch(href)}"), "desktop navigation intent starts route prefetch before navigation");
assert.ok(shell.includes('performance.measure("solenos.workspace.route-mounted"'), "workspace route navigation has a local click-to-mount timing measurement");
assert.ok(shell.includes("markNavigationStart(href)"), "each primary workspace navigation click records its start time");
assert.ok(workspace.includes("<LCRCurrentUnderstanding />"), "the default workspace route still opens the actual Living Care Record");

assert.ok(landing.includes('fetchPriority="high"'), "the landing hero image is prioritized for initial rendering");
assert.ok(landing.includes("srcSet=") && landing.includes("sizes="), "mobile devices can select a smaller landing hero asset");
assert.ok(landing.includes("<LandingStartLink"), "landing CTAs use a client-side timing link without converting the landing page into a client component");
assert.ok(fs.readFileSync("src/components/public/LandingStartLink.tsx", "utf8").includes('performance.mark("solenos.journey.landing-cta")'), "landing CTA click marks the start of the tap-to-care journey");
assert.ok(lcr.includes('performance.measure("solenos.journey.landing-to-first-care"'), "the tap-to-first-care metric spans the landing CTA to the validated care projection");
assert.ok(landing.includes("<LazyBackground"), "below-the-fold landing photography uses deferred backgrounds");
assert.ok(lazyBackground.includes("IntersectionObserver"), "below-the-fold images load near the viewport, not at initial page load");
assert.ok(lazyBackground.includes('rootMargin: "400px 0px"'), "lazy images begin loading shortly before entering view");
assert.ok(!landingCss.includes("images.unsplash.com"), "the landing stylesheet must not eagerly request every below-the-fold image");

console.log("PASS: landing hero is prioritized; below-the-fold photography is deferred.");
console.log("PASS: current-care first-ready is independent of registered actions and secondary continuity work.");
console.log("PASS: advanced LCR panels and secondary workspace routes do not load before caregiver intent.");
