export {
  TRUST_LAYER_IDENTITY,
  TRUST_LAYER_ONE_LINE_TRUTH,
  TRUST_LAYER_PIPELINE_POSITION,
  TRUST_LAYER_FORBIDDEN,
  FOOTER_STRICT_ORDER,
  REQUIRED_FOOTER_KINDS,
  DOMAIN_DISCLAIMER_TEXT,
  FOOTER_TEXT,
} from "./contract-constants";
export {
  DISCLAIMER_DOMAINS,
  FOOTER_KINDS,
} from "./types";
export type {
  DisclaimerDomain,
  FooterKind,
  DomainDisclaimer,
  FooterSection,
  OutputAssemblyContext,
  AssembledOutput,
  TrustLayerPayload,
  SystemGuaranteeResult,
  DomainTriggerResult,
} from "./types";
export {
  MEDICAL_TRIGGER_PATTERNS,
  INSURANCE_TRIGGER_PATTERNS,
  BENEFITS_TRIGGER_PATTERNS,
  detectTriggeredDomains,
} from "./domain-triggers";
export { runDisclaimerEngine } from "./disclaimer-engine";
export { runFooterEngine } from "./footer-engine";
export { runSystemGuaranteeCheck } from "./system-guarantee";
export {
  assembleOutputLayer,
  toTrustLayerPayload,
  type OutputAssemblyResult,
} from "./output-assembly";
