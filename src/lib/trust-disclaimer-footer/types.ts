import type { SolenOSResponse } from "../response-validator";
import type { DocumentIntakeOutput } from "../document-intake";
import type { DocumentIntelligenceLayerPayload } from "../document-intelligence";

export const DISCLAIMER_DOMAINS = ["MEDICAL", "INSURANCE", "BENEFITS", "DOCUMENT"] as const;
export type DisclaimerDomain = (typeof DISCLAIMER_DOMAINS)[number];

export const FOOTER_KINDS = [
  "DOCUMENT_SAFETY",
  "MEDICAL_SAFETY",
  "INSURANCE_BENEFITS",
  "SYSTEM_LIMIT",
  "ASSUMPTIONS",
  "CONFIDENCE",
  "UNCERTAINTY",
] as const;
export type FooterKind = (typeof FOOTER_KINDS)[number];

export type DomainDisclaimer = {
  domain: DisclaimerDomain;
  text: string;
};

export type FooterSection = {
  kind: FooterKind;
  text: string;
};

export type OutputAssemblyContext = {
  rawInput: string;
  documentIntake?: DocumentIntakeOutput;
  documentIntelligence?: DocumentIntelligenceLayerPayload;
};

export type AssembledOutput = {
  disclaimers: readonly DomainDisclaimer[];
  response: SolenOSResponse;
  footers: readonly FooterSection[];
};

export type TrustLayerPayload = {
  disclaimers: readonly DomainDisclaimer[];
  footers: readonly FooterSection[];
};

export type SystemGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type DomainTriggerResult = {
  triggeredDomains: DisclaimerDomain[];
};
