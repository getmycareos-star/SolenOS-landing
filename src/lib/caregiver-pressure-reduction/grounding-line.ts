import type { SolenOSResponse } from "../response-validator";

/** UI-only grounding — never part of JSON schema or model output. */
/** Caregiver Reality Principle 3: feel understood before explaining. @see ../caregiver-reality-principles */
const GROUNDING_BY_RISK: Partial<Record<SolenOSResponse["risk_level"], string>> = {
  low: "A lot sits on you that others don't see — what follows holds it without asking you to explain.",
  medium: "The load is real even when it's invisible — what follows separates signal from noise.",
  high: "What was shared needs a clear next step — what follows narrows focus without adding to your plate.",
};

/** Optional one short grounding sentence before structured output (UI layer only). */
export function resolvePreStructureGroundingLine(
  output: SolenOSResponse,
): string | null {
  return GROUNDING_BY_RISK[output.risk_level] ?? null;
}
