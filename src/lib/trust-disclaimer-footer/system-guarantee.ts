import { FOOTER_STRICT_ORDER, REQUIRED_FOOTER_KINDS } from "./contract-constants";
import type {
  AssembledOutput,
  DomainDisclaimer,
  FooterKind,
  FooterSection,
  SystemGuaranteeResult,
} from "./types";

function footerKindsInOrder(footers: readonly FooterSection[]): FooterKind[] {
  return footers.map((footer) => footer.kind);
}

function isFooterOrderValid(actual: FooterKind[]): boolean {
  let lastOrderIdx = -1;
  for (const kind of actual) {
    const orderIdx = FOOTER_STRICT_ORDER.indexOf(kind);
    if (orderIdx === -1) return false;
    if (orderIdx <= lastOrderIdx) return false;
    lastOrderIdx = orderIdx;
  }
  return true;
}

function missingRequiredFooters(footers: readonly FooterSection[]): FooterKind[] {
  const present = new Set(footers.map((footer) => footer.kind));
  return REQUIRED_FOOTER_KINDS.filter((kind) => !present.has(kind));
}

function missingDomainDisclaimers(
  disclaimers: readonly DomainDisclaimer[],
  footers: readonly FooterSection[],
): string[] {
  const violations: string[] = [];
  const disclaimerDomains = new Set(disclaimers.map((d) => d.domain));
  const footerKinds = new Set(footers.map((f) => f.kind));

  if (disclaimerDomains.has("DOCUMENT") && !footerKinds.has("DOCUMENT_SAFETY")) {
    violations.push("DOCUMENT disclaimer triggered but DOCUMENT_SAFETY footer missing");
  }
  if (disclaimerDomains.has("MEDICAL") && !footerKinds.has("MEDICAL_SAFETY")) {
    violations.push("MEDICAL disclaimer triggered but MEDICAL_SAFETY footer missing");
  }
  if (
    (disclaimerDomains.has("INSURANCE") || disclaimerDomains.has("BENEFITS")) &&
    !footerKinds.has("INSURANCE_BENEFITS")
  ) {
    violations.push("INSURANCE/BENEFITS disclaimer triggered but footer missing");
  }

  return violations;
}

function responseUnchanged(
  before: AssembledOutput["response"],
  after: AssembledOutput["response"],
): boolean {
  return (
    before.what_is_happening === after.what_is_happening &&
    before.what_matters_now === after.what_matters_now &&
    before.what_to_ask_next === after.what_to_ask_next &&
    before.risk_level === after.risk_level &&
    before.what_can_wait === after.what_can_wait
  );
}

/**
 * Final validation before returning assembled output.
 */
export function runSystemGuaranteeCheck(
  assembled: AssembledOutput,
  originalResponse: AssembledOutput["response"],
): SystemGuaranteeResult {
  const violations: string[] = [];

  if (!responseUnchanged(originalResponse, assembled.response)) {
    violations.push("reasoning contamination: SolenOS response fields were modified");
  }

  const missingRequired = missingRequiredFooters(assembled.footers);
  if (missingRequired.length > 0) {
    violations.push(`missing required footers: ${missingRequired.join(", ")}`);
  }

  const kinds = footerKindsInOrder(assembled.footers);
  if (!isFooterOrderValid(kinds)) {
    violations.push("footer ordering violation");
  }

  if (kinds[kinds.length - 1] !== "UNCERTAINTY") {
    violations.push("UNCERTAINTY footer must be last");
  }

  const assumptionsFooter = assembled.footers.find((f) => f.kind === "ASSUMPTIONS");
  if (!assumptionsFooter || assumptionsFooter.text.trim().length === 0) {
    violations.push("assumptions footer must exist even if empty");
  }

  const confidenceFooter = assembled.footers.find((f) => f.kind === "CONFIDENCE");
  if (!confidenceFooter || confidenceFooter.text.trim().length === 0) {
    violations.push("confidence footer missing");
  }

  const uncertaintyFooter = assembled.footers.find((f) => f.kind === "UNCERTAINTY");
  if (!uncertaintyFooter || uncertaintyFooter.text.trim().length === 0) {
    violations.push("uncertainty footer missing");
  }

  violations.push(...missingDomainDisclaimers(assembled.disclaimers, assembled.footers));

  for (const disclaimer of assembled.disclaimers) {
    if (!disclaimer.text.trim()) {
      violations.push(`empty disclaimer text for domain ${disclaimer.domain}`);
    }
  }

  return { ok: violations.length === 0, violations };
}
