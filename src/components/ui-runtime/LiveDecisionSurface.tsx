import type { DecisionCard } from "@/lib/ui-runtime";
import type { ContinuityLayerPayload } from "@/lib/identity-continuity";
import type { TrustLayerPayload } from "@/lib/trust-disclaimer-footer";
import type { UiStrings } from "@/lib/i18n";

import { ContinuityPrompt } from "../ContinuityPrompt";
import { HumanValidationLoop } from "../HumanValidationLoop";
import { DecisionCardView } from "./DecisionCardView";

interface LiveDecisionSurfaceProps {
  card: DecisionCard | null;
  loading: boolean;
  trustLayer?: TrustLayerPayload;
  continuityLayer?: ContinuityLayerPayload;
  careSessionId: string | null;
  careKey?: string | null;
  telemetryUserId: string | null;
  interactionId: string | null;
  validationComplete: boolean;
  onValidationComplete: () => void;
  onIdentityBound: (params: { userId: string; careSessionId: string }) => void;
  strings: UiStrings;
}

/**
 * Live Decision Surface — exactly ONE active DecisionCard.
 * Loading replaces content; never accumulates a conversation feed.
 */
export function LiveDecisionSurface({
  card,
  loading,
  trustLayer,
  continuityLayer,
  careSessionId,
  careKey,
  telemetryUserId,
  interactionId,
  validationComplete,
  onValidationComplete,
  onIdentityBound,
  strings,
}: LiveDecisionSurfaceProps) {
  return (
    <section className="live-decision-surface" aria-label="Live decision surface">
      <header className="region-header">
        <h2 className="region-title">Decision</h2>
        <p className="region-hint">Current operational read — replaced on each inference</p>
      </header>

      {loading && (
        <p className="decision-loading" role="status">
          Updating operational state…
        </p>
      )}

      {!loading && !card && (
        <p className="decision-empty">
          Describe a caregiving situation below. The system will replace this surface with a
          single decision card.
        </p>
      )}

      {!loading && card && <DecisionCardView card={card} trustLayer={trustLayer} />}

      {continuityLayer && (
        <ContinuityPrompt
          continuityLayer={continuityLayer}
          careSessionId={careSessionId}
          telemetryUserId={telemetryUserId}
          strings={strings}
          onIdentityBound={onIdentityBound}
        />
      )}

      {!validationComplete && interactionId && (
        <HumanValidationLoop
          interactionId={interactionId}
          careKey={careKey}
          onComplete={onValidationComplete}
        />
      )}
    </section>
  );
}
