import type { SolenOSResponse } from "../response-validator";
import { outputImpliesIncompleteContext } from "../solenos-fields";
import { FOOTER_TEXT } from "./contract-constants";
import type { DomainDisclaimer, FooterSection, OutputAssemblyContext } from "./types";

const ASSUMPTION_MARKERS =
  /\b(assuming|assumed|if (?:this|that|she|he|they)|likely|probably|may be|might be|appears to)\b/i;

function extractAssumptions(response: SolenOSResponse): string[] {
  const assumptions: string[] = [];
  const fields = [
    response.what_is_happening,
    response.what_matters_now,
    response.what_can_wait,
  ] as const;

  for (const field of fields) {
    if (ASSUMPTION_MARKERS.test(field)) {
      const sentence = field.split(/(?<=[.!?])\s+/)[0]?.trim();
      if (sentence && sentence.length > 10) {
        assumptions.push(sentence);
      }
    }
  }

  return assumptions.slice(0, 3);
}

function buildDocumentSafetyFooter(disclaimers: readonly DomainDisclaimer[]): FooterSection | null {
  if (!disclaimers.some((d) => d.domain === "DOCUMENT")) return null;
  const disclaimer = disclaimers.find((d) => d.domain === "DOCUMENT");
  return {
    kind: "DOCUMENT_SAFETY",
    text: disclaimer?.text ?? FOOTER_TEXT.SYSTEM_LIMIT,
  };
}

function buildMedicalSafetyFooter(disclaimers: readonly DomainDisclaimer[]): FooterSection | null {
  if (!disclaimers.some((d) => d.domain === "MEDICAL")) return null;
  const disclaimer = disclaimers.find((d) => d.domain === "MEDICAL");
  return {
    kind: "MEDICAL_SAFETY",
    text: disclaimer?.text ?? FOOTER_TEXT.SYSTEM_LIMIT,
  };
}

function buildInsuranceBenefitsFooter(
  disclaimers: readonly DomainDisclaimer[],
): FooterSection | null {
  const insurance = disclaimers.find((d) => d.domain === "INSURANCE");
  const benefits = disclaimers.find((d) => d.domain === "BENEFITS");
  if (!insurance && !benefits) return null;

  const parts = [insurance?.text, benefits?.text].filter(Boolean);
  return {
    kind: "INSURANCE_BENEFITS",
    text: parts.join(" "),
  };
}

function buildAssumptionsFooter(response: SolenOSResponse): FooterSection {
  const assumptions = extractAssumptions(response);
  if (assumptions.length === 0) {
    return { kind: "ASSUMPTIONS", text: FOOTER_TEXT.ASSUMPTIONS_EMPTY };
  }
  return {
    kind: "ASSUMPTIONS",
    text: `Assumptions surfaced: ${assumptions.join(" | ")}`,
  };
}

function buildConfidenceFooter(response: SolenOSResponse): FooterSection {
  return {
    kind: "CONFIDENCE",
    text: FOOTER_TEXT.CONFIDENCE[response.risk_level],
  };
}

function buildDocumentIntelligenceUncertaintyFooter(
  context?: Pick<OutputAssemblyContext, "documentIntelligence">,
): FooterSection | null {
  const intel = context?.documentIntelligence;
  if (!intel || intel.nodeCount === 0 || !intel.uncertaintyFlagged) return null;
  return {
    kind: "UNCERTAINTY",
    text: `${FOOTER_TEXT.UNCERTAINTY} Document extraction confidence is below threshold (${intel.overallConfidence.toFixed(2)}) — ambiguity surfaced, missing fields not assumed.`,
  };
}

function buildUncertaintyFooter(
  response: SolenOSResponse,
  context?: Pick<OutputAssemblyContext, "documentIntelligence">,
): FooterSection {
  const docUncertainty = buildDocumentIntelligenceUncertaintyFooter(context);
  if (docUncertainty) return docUncertainty;

  const incomplete = outputImpliesIncompleteContext(response);
  const base = FOOTER_TEXT.UNCERTAINTY;
  if (!incomplete) {
    return { kind: "UNCERTAINTY", text: base };
  }
  return {
    kind: "UNCERTAINTY",
    text: `${base} Open gaps remain in the input or interpretation.`,
  };
}

/**
 * Post-reasoning audit footers — strict order, metadata only.
 */
export function runFooterEngine(
  response: SolenOSResponse,
  disclaimers: readonly DomainDisclaimer[],
  context?: Pick<OutputAssemblyContext, "documentIntelligence">,
): FooterSection[] {
  const footers: FooterSection[] = [];

  const documentFooter = buildDocumentSafetyFooter(disclaimers);
  if (documentFooter) footers.push(documentFooter);

  const medicalFooter = buildMedicalSafetyFooter(disclaimers);
  if (medicalFooter) footers.push(medicalFooter);

  const insuranceFooter = buildInsuranceBenefitsFooter(disclaimers);
  if (insuranceFooter) footers.push(insuranceFooter);

  footers.push({ kind: "SYSTEM_LIMIT", text: FOOTER_TEXT.SYSTEM_LIMIT });
  footers.push(buildAssumptionsFooter(response));
  footers.push(buildConfidenceFooter(response));
  footers.push(buildUncertaintyFooter(response, context));

  return footers;
}
