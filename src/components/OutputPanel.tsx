import type { SolenOSResponse } from "@/lib/output-contract";
import type { ContinuityLayerPayload } from "@/lib/identity-continuity";
import type { TrustLayerPayload } from "@/lib/trust-disclaimer-footer";
import type { UiStrings } from "@/lib/i18n";

import { ContinuityPrompt } from "./ContinuityPrompt";
import { OutputRenderer } from "./OutputRenderer";
import { HumanValidationLoop } from "./HumanValidationLoop";

interface OutputPanelProps {
  output: SolenOSResponse;
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

export function OutputPanel({
  output,
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
}: OutputPanelProps) {
  return (
    <section className="panel output-panel">
      <OutputRenderer output={output} trustLayer={trustLayer} />

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
