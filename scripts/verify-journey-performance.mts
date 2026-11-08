import assert from "node:assert/strict";
import fs from "node:fs";

const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const landing = fs.readFileSync("src/app/page.tsx", "utf8");
const landingCss = fs.readFileSync("src/app/landing.css", "utf8");
const lazyBackground = fs.readFileSync("src/components/public/LazyBackground.tsx", "utf8");
const workspace = fs.readFileSync("src/app/workspace/page.tsx", "utf8");

const projectionRequest = lcr.indexOf('await getJSON("/care-continuity/current-care?limit_per_source=12")');
const firstReady = lcr.indexOf("setLoading(false)", projectionRequest);
const backgroundActions = lcr.indexOf('getJSON(`/registered-actions/', projectionRequest);
const backgroundTasks = lcr.indexOf("void (async () => {", projectionRequest);

assert.ok(projectionRequest >= 0, "the current-care projection remains the authoritative first-screen read");
assert.ok(firstReady > projectionRequest, "the caregiver first screen is released after validating the current-care projection");
assert.ok(backgroundTasks > firstReady, "secondary continuity work starts only after the first-care ready point");
assert.ok(backgroundActions > firstReady, "registered actions no longer block the first caregiver screen");
assert.ok(lcr.includes('performance.measure("solenos.workspace.first-care-ready"'), "first-care readiness has a local browser performance measurement");
assert.ok(lcr.includes('dynamic(() => import("@/components/CareContinuityIntegrityPanel"))'), "advanced integrity code is split into an on-demand chunk");
assert.ok(lcr.includes('dynamic(() => import("@/components/EvidenceReviewPanel"))'), "evidence review code is split into an on-demand chunk");
assert.ok(lcr.includes("onToggle={(event) => setAdvancedIntegrityOpen(event.currentTarget.open)}"), "advanced integrity panels mount only after the caregiver opens the section");
assert.ok(lcr.includes("{advancedIntegrityOpen && ("), "collapsed advanced panels do not mount and issue background API requests");

assert.ok((shell.match(/prefetch={false}/g) || []).length >= 2, "secondary workspace navigation must not prefetch every route bundle");
assert.ok(workspace.includes("<LCRCurrentUnderstanding />"), "the default workspace route still opens the actual Living Care Record");

assert.ok(landing.includes('fetchPriority="high"'), "the landing hero image is prioritized for initial rendering");
assert.ok(landing.includes("<LazyBackground"), "below-the-fold landing photography uses deferred backgrounds");
assert.ok(lazyBackground.includes("IntersectionObserver"), "below-the-fold images load near the viewport, not at initial page load");
assert.ok(lazyBackground.includes('rootMargin: "400px 0px"'), "lazy images begin loading shortly before entering view");
assert.ok(!landingCss.includes("images.unsplash.com"), "the landing stylesheet must not eagerly request every below-the-fold image");

console.log("PASS: landing hero is prioritized; below-the-fold photography is deferred.");
console.log("PASS: current-care first-ready is independent of registered actions and secondary continuity work.");
console.log("PASS: advanced LCR panels and secondary workspace routes do not load before caregiver intent.");
