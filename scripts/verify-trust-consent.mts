/**
 * Trust, Legal & User Consent Flow — MVP acceptance.
 * SoT: docs/02-product/solenos-trust-consent-flow.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TRUST_NAV,
  TRUST_FOOTER_LINKS,
  IN_PRODUCT_LEGAL_LINKS,
  ABOUT_SOLENOS_SECTIONS,
  PRIVACY_POLICY,
  TERMS_OF_USE,
  canSubmitEarlyAccessConsent,
  TRUST_LEGAL_PUBLIC_ROUTES,
  EARLY_ACCESS_CONSENT_PURPOSE,
} from "../src/lib/trust-content";
import {
  SUPPORT_EMAIL,
  RESEARCH_PREVIEW_SECTION,
  FREE_EARLY_ACCESS_SECTION,
  hasResearchPreviewAck,
  markResearchPreviewAck,
  RESEARCH_PREVIEW_CONSENT_KEY,
  UNDERSTANDING_FEEDBACK_QUESTION,
  UNDERSTANDING_MISUNDERSTAND_OPTIONS,
  UPLOAD_PRIVACY_NOTICE,
  EMERGENCY_BOUNDARY,
} from "../src/lib/early-access-trust";

const root = process.cwd();

console.log("=== Trust, Legal & User Consent ===\n");
console.log(EARLY_ACCESS_CONSENT_PURPOSE);

assert.equal(canSubmitEarlyAccessConsent({ termsAccepted: false, privacyAccepted: false }), false);
assert.equal(canSubmitEarlyAccessConsent({ termsAccepted: true, privacyAccepted: false }), false);
assert.equal(canSubmitEarlyAccessConsent({ termsAccepted: false, privacyAccepted: true }), false);
assert.equal(canSubmitEarlyAccessConsent({ termsAccepted: true, privacyAccepted: true }), true);
console.log("✓ signup submit requires both Terms + Privacy");

const footerLabels = TRUST_FOOTER_LINKS.map((l) => l.label);
for (const required of ["Privacy Policy", "Terms of Service", "Contact", "Help"]) {
  assert(footerLabels.includes(required), `footer must include ${required}`);
}
console.log("✓ public footer includes Privacy, Terms of Service, Contact, Help");

const navLabels = TRUST_NAV.map((l) => l.label);
for (const required of ["Home", "Why SolenOS", "How It Works", "About SolenOS", "Help", "Early Access", "Start"]) {
  assert(navLabels.includes(required), `nav must include ${required}`);
}
console.log("✓ public nav structure");

const inProduct = IN_PRODUCT_LEGAL_LINKS.map((l) => l.href);
for (const href of ["/privacy", "/terms", "/about", "/contact", "/support"]) {
  assert(inProduct.includes(href), `in-product must link ${href}`);
}
assert.equal(IN_PRODUCT_LEGAL_LINKS[0]?.label, "Help");
console.log("✓ in-product legal links (Help first)");

const aboutIds = ABOUT_SOLENOS_SECTIONS.map((s) => s.id);
assert(aboutIds.includes("privacy"));
assert(aboutIds.includes("terms"));
assert(aboutIds.includes("contact"));
assert(aboutIds.includes("support"));
console.log("✓ About SolenOS sections include Privacy, Terms, Contact, Help");

assert(PRIVACY_POLICY.title.includes("Privacy"));
assert(TERMS_OF_USE.title.includes("Terms"));
assert(PRIVACY_POLICY.sections.length >= 3);
assert(TERMS_OF_USE.sections.length >= 3);
assert(TERMS_OF_USE.sections.some((s) => /not medical advice/i.test(s.title)));
assert(SUPPORT_EMAIL === "davidsolenos@gmail.com");
assert(PRIVACY_POLICY.sections.some((s) => s.body.some((b) => b.includes(SUPPORT_EMAIL))));
console.log("✓ Privacy Policy and Terms of Service content + support email");

for (const route of TRUST_LEGAL_PUBLIC_ROUTES) {
  const pagePath = path.join(root, "src", "app", route.slice(1), "page.tsx");
  assert(fs.existsSync(pagePath), `missing page for ${route}: ${pagePath}`);
}
assert(fs.existsSync(path.join(root, "src", "app", "help", "page.tsx")));
console.log("✓ public legal + early-access + /help pages exist");

const consentForm = fs.readFileSync(
  path.join(root, "src", "components", "public", "EarlyAccessConsentForm.tsx"),
  "utf8",
);
assert(consentForm.includes('href="/terms"'));
assert(consentForm.includes('href="/privacy"'));
assert(consentForm.includes("Terms of Service"));
assert(consentForm.includes("disabled={!ready}"));
assert(consentForm.includes('target="_blank"'));
console.log("✓ early-access consent form links + disabled submit");

const earlyAccessPage = fs.readFileSync(
  path.join(root, "src", "app", "early-access", "page.tsx"),
  "utf8",
);
assert(earlyAccessPage.includes("EarlyAccessConsentForm"));
console.log("✓ early-access page wires consent form");

const consentGate = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "ConsentGatePanel.tsx"),
  "utf8",
);
assert(consentGate.includes('href="/terms"'));
assert(consentGate.includes('href="/privacy"'));
console.log("✓ in-product consent gate links to legal docs");

assert.ok(RESEARCH_PREVIEW_SECTION.ackLabel.includes("early version"));
assert.ok(FREE_EARLY_ACCESS_SECTION.body.some((p) => /early access period at no cost/i.test(p)));
assert.ok(!/free forever/i.test(FREE_EARLY_ACCESS_SECTION.body.join(" ")));
assert.ok(UNDERSTANDING_FEEDBACK_QUESTION.includes("understand this situation"));
assert.equal(UNDERSTANDING_MISUNDERSTAND_OPTIONS.length, 5);
assert.ok(UPLOAD_PRIVACY_NOTICE.includes("comfortable storing"));
assert.ok(EMERGENCY_BOUNDARY.includes("emergency"));
console.log("✓ early-access trust copy contracts");

{
  // Node has no localStorage — functions must degrade safely
  assert.equal(hasResearchPreviewAck(), false);
  markResearchPreviewAck(); // no-op without window
  assert.equal(RESEARCH_PREVIEW_CONSENT_KEY, "solenos_research_preview_ack_v1");
}

const welcome = fs.readFileSync(
  path.join(root, "src", "app", "start", "page.tsx"),
  "utf8",
);
assert(welcome.includes("WelcomeTrustStack"));
assert(welcome.includes("Early Access"));
assert(!/legal wall|onboarding wall/i.test(welcome) || welcome.includes("Do not add a separate") || welcome.includes("Not a separate"));

const trustStack = fs.readFileSync(
  path.join(root, "src", "components", "public", "WelcomeTrustStack.tsx"),
  "utf8",
);
assert(trustStack.includes("RESEARCH_PREVIEW_SECTION"));
assert(trustStack.includes("FREE_EARLY_ACCESS_SECTION"));
assert(trustStack.includes("YOUR_INFORMATION_SECTION"));

const productPage = fs.readFileSync(path.join(root, "src", "app", "workspace", "page.tsx"), "utf8");
assert(productPage.includes("ResearchPreviewAckGate"));
assert(productPage.includes("EARLY_ACCESS_BADGE"));

const landing = fs.readFileSync(path.join(root, "src", "app", "page.tsx"), "utf8");
assert(landing.includes("Enter SolenOS"));
assert(landing.includes('href="/start"'));

const ackGate = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "ResearchPreviewAckGate.tsx"),
  "utf8",
);
assert(ackGate.includes("markResearchPreviewAck"));
assert(ackGate.includes("RESEARCH_PREVIEW_SECTION.ackLabel") || ackGate.includes("early version"));

const addPanel = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "AddSituationPanel.tsx"),
  "utf8",
);
assert(addPanel.includes("UPLOAD_PRIVACY_NOTICE"));

const sidebar = fs.readFileSync(
  path.join(root, "src", "components", "ui-runtime", "Sidebar.tsx"),
  "utf8",
);
assert(sidebar.includes("IN_PRODUCT_LEGAL_LINKS"));

const feedback = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "UnderstandingFeedbackPrompt.tsx"),
  "utf8",
);
assert(feedback.includes("UNDERSTANDING_FEEDBACK_QUESTION"));
assert(feedback.includes("Needs improvement"));
assert(feedback.includes("Report misunderstanding"));

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-trust-consent-flow.md"),
  "utf8",
);
assert(sot.includes("no legal wall") || sot.includes("blocking legal wall"));
assert(sot.includes("Research Preview") || sot.includes("research preview"));
console.log("✓ welcome trust stack + ack gate + upload notice + feedback + SoT");

console.log("\nAll trust-consent checks passed.");
