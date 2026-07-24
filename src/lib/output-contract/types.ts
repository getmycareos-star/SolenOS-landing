import { REQUIRED_OUTPUT_FIELDS } from "../final-output-contract";
import type { SolenOSResponse } from "../response-validator";
import type { ContinuityLayerPayload } from "../identity-continuity";
import type { TrustLayerPayload } from "../trust-disclaimer-footer";
import type { CareProfileLayerPayload } from "../care-profile/types";
import type { CareContextLayerPayload } from "../care-context/situational/types";
import type { MemoryInfluenceLayerPayload } from "../memory-influence/types";
import type { AssumptionRegistryLayerPayload } from "../assumption-registry/types";
import type { MissingInformationQueueLayerPayload } from "../missing-information-queue/types";
import type { SafetyLayerPayload } from "../safety-enforcement/types";
import type { GovernanceLayerPayload } from "../settings-governance/types";
import type { HumanTrustLayerPayload } from "../human-trust-layer";

export type { SolenOSResponse };
export type { ContinuityLayerPayload };

export type SolenOSRiskLevel = SolenOSResponse["risk_level"];
export type RiskLevel = SolenOSRiskLevel;

export type PipelineOutput = SolenOSResponse;
export type SolenOSOutput = PipelineOutput;

/** API success payload — strict 5-field response plus optional post-reasoning layers. */
export type AnalyzeSuccessWithTrustLayer = SolenOSResponse & {
  trust_layer?: TrustLayerPayload;
  continuity_layer?: ContinuityLayerPayload;
  governance_layer?: GovernanceLayerPayload;
  safety_layer?: SafetyLayerPayload;
  /** HUMAN TRUST — understand / challenge / undo; distinct from trust_layer disclaimers. */
  human_trust_layer?: HumanTrustLayerPayload;
  care_profile_layer?: CareProfileLayerPayload;
  care_context_layer?: CareContextLayerPayload;
  memory_influence_layer?: MemoryInfluenceLayerPayload;
  assumption_registry_layer?: AssumptionRegistryLayerPayload;
  missing_information_queue_layer?: MissingInformationQueueLayerPayload;
};

export const SOLENOS_RESPONSE_KEYS: (keyof SolenOSResponse)[] = [
  ...(REQUIRED_OUTPUT_FIELDS as unknown as (keyof SolenOSResponse)[]),
];

export const OUTPUT_CONTRACT_KEYS = SOLENOS_RESPONSE_KEYS;
export const RISK_LEVELS: SolenOSRiskLevel[] = ["low", "medium", "high"];

export type { AnalyzeRequest } from "../analyze-pipeline/request";
export type { AnalyzeFailureResponse } from "../analyze-pipeline/constants";
export type AnalyzeSuccessResponse = SolenOSResponse;
