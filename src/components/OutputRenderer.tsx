import type { SolenOSResponse } from "@/lib/output-contract";
import type { TrustLayerPayload } from "@/lib/trust-disclaimer-footer";
import { mapSolenOSToDecisionCard } from "@/lib/ui-runtime";
import { DecisionCardView } from "@/components/ui-runtime/DecisionCardView";

/**
 * Legacy renderer — maps SolenOSResponse to the single DecisionCard surface.
 * Prefer LiveDecisionSurface in the UI runtime shell.
 */
export function OutputRenderer({
  output,
  trustLayer,
  situationId = "legacy",
}: {
  output: SolenOSResponse;
  trustLayer?: TrustLayerPayload;
  situationId?: string;
}) {
  const card = mapSolenOSToDecisionCard({ situationId, response: output });
  return <DecisionCardView card={card} trustLayer={trustLayer} />;
}
