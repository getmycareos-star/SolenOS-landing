/**
 * Trust and legal information remains discoverable without blocking LCR entry.
 * Optional data-improvement consent remains a separate, revocable Settings choice.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TRUST_FOOTER_LINKS,
  IN_PRODUCT_LEGAL_LINKS,
  ABOUT_SOLENOS_SECTIONS,
  PRIVACY_POLICY,
  TERMS_OF_USE,
  TRUST_LEGAL_PUBLIC_ROUTES,
} from "../src/lib/trust-content";

const root = process.cwd();
for (const required of ["Privacy Policy", "Terms of Service", "Contact", "Help"]) {
  assert(TRUST_FOOTER_LINKS.some((link) => link.label === required), `footer includes ${required}`);
}
for (const href of ["/privacy", "/terms", "/about", "/contact", "/support"]) {
  assert(IN_PRODUCT_LEGAL_LINKS.some((link) => link.href === href), `in-product links include ${href}`);
}
for (const id of ["privacy", "terms", "contact", "support"]) {
  assert(ABOUT_SOLENOS_SECTIONS.some((section) => section.id === id), `About includes ${id}`);
}
assert(PRIVACY_POLICY.title.includes("Privacy"));
assert(TERMS_OF_USE.title.includes("Terms"));
assert(PRIVACY_POLICY.sections.length >= 3);
assert(TERMS_OF_USE.sections.length >= 3);

for (const route of TRUST_LEGAL_PUBLIC_ROUTES) {
  assert(fs.existsSync(path.join(root, "src", "app", route.slice(1), "page.tsx")), `legal route exists: ${route}`);
}
assert(fs.existsSync(path.join(root, "src/app/help/page.tsx")));

const earlyAccess = fs.readFileSync(path.join(root, "src/app/early-access/page.tsx"), "utf8");
const workspaceLayout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");
assert.match(earlyAccess, /href="\/workspace\?enter=1"/);
assert.doesNotMatch(earlyAccess, /EarlyAccessConsentForm|type="checkbox"|ResearchPreviewAckGate/);
assert.doesNotMatch(workspaceLayout, /ConsentGatePanel|WorkspacePrivacyBoundary|ResearchPreviewAckGate|type="checkbox"/);

const settings = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PolicySettingsPanel.tsx"), "utf8");
assert(settings.includes("Help improve SolenOS (optional)"));
assert(settings.includes("data_improvement_consent: enabled"));
assert(settings.includes("update_data_improvement"));

console.log("✓ privacy and terms remain accessible without a pre-workspace checkbox");
console.log("✓ optional data-improvement preference remains separate from workspace entry");
