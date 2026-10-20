import { DOMAIN_DISCLAIMER_TEXT } from "./contract-constants";
import { detectTriggeredDomains } from "./domain-triggers";
import type { DomainDisclaimer, OutputAssemblyContext } from "./types";

/**
 * Post-reasoning domain safety boundary annotations — never modifies response fields.
 */
export function runDisclaimerEngine(context: OutputAssemblyContext): DomainDisclaimer[] {
  const domains = detectTriggeredDomains(
    context.rawInput,
    context.documentIntake,
    context.documentIntelligence,
  );
  return domains.map((domain) => ({
    domain,
    text: DOMAIN_DISCLAIMER_TEXT[domain],
  }));
}
