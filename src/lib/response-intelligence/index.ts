/**
 * Response Intelligence — meaning over language patterns.
 * SoT: docs/02-product/solenos-response-intelligence-directive.md
 * Output schema SoT: docs/02-product/solenos-response-contract.md
 */

export {
  RESPONSE_INTELLIGENCE_PURPOSE,
  RESPONSE_INTELLIGENCE_PIPELINE,
  RESPONSE_OUTPUT_FIELDS,
  RESPONSE_AI_PRODUCT_LANGUAGE_BANS,
  RESPONSE_GOLDEN_SOFT_INPUTS,
  RESPONSE_HARD_FAILURE_CHECKS,
} from "./contract-constants";

export type {
  ResponseIntelligenceOutput,
  ResponseRiskLevel,
  GoldenSoftOrientationCheck,
} from "./types";

export { assertNoAiProductLanguage, containsAiProductLanguage } from "./ai-product-language";
export { evaluateGoldenSoftOrientation } from "./golden-soft-orientation";
export { buildResponseIntelligenceOutput } from "./build-output";
export {
  RISK_FROM_EVIDENCE_PURPOSE,
  inferRiskFromHeldCareEvidence,
} from "./risk-from-evidence";
export {
  ATTENTION_LABELS_BY_RISK,
  humanAttentionLabelFor,
  shouldDiscloseAttentionLevel,
  containsAttentionScoreTheater,
} from "./attention-label";

export {
  RESPONSE_CONTRACT_PURPOSE,
  RESPONSE_CONTRACT_FIELDS,
  RESPONSE_CONTRACT_PIPELINE,
  RESPONSE_CONTRACT_NEVER_SAY,
  buildResponseContractOutput,
  assertNoResponseContractNeverSay,
  assertNoHardcodedScenarioBranch,
} from "../response-contract";
