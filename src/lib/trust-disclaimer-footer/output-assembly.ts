import type { SolenOSResponse } from "../response-validator";
import { runDisclaimerEngine } from "./disclaimer-engine";
import { runFooterEngine } from "./footer-engine";
import { runSystemGuaranteeCheck } from "./system-guarantee";
import type { AssembledOutput, OutputAssemblyContext, TrustLayerPayload } from "./types";

export type OutputAssemblyResult = {
  assembled: AssembledOutput;
  guarantee: ReturnType<typeof runSystemGuaranteeCheck>;
};

/**
 * OUTPUT ASSEMBLY LAYER — disclaimer engine → footer engine → guarantee check.
 * SolenOS response fields are passed through unchanged.
 */
export function assembleOutputLayer(
  response: SolenOSResponse,
  context: OutputAssemblyContext,
): OutputAssemblyResult {
  const originalResponse = { ...response };
  const disclaimers = runDisclaimerEngine(context);
  const footers = runFooterEngine(response, disclaimers, context);

  const assembled: AssembledOutput = {
    disclaimers,
    response: originalResponse,
    footers,
  };

  const guarantee = runSystemGuaranteeCheck(assembled, originalResponse);

  return { assembled, guarantee };
}

export function toTrustLayerPayload(assembled: AssembledOutput): TrustLayerPayload {
  return {
    disclaimers: assembled.disclaimers,
    footers: assembled.footers,
  };
}
