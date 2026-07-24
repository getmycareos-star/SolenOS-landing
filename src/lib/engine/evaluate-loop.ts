import type { LoopSignal, LoopState } from "./domain/types";

/**
 * CLARITY_STATE → LOOP_STATE
 * Session feedback — was cognitive relief achieved?
 */
export function evaluateLoop(signal: LoopSignal): LoopState {
  const relief_detected =
    signal.clarityReached && !signal.userFrustrationSignals;

  const confusion_persisted =
    signal.requeryWithin30s ||
    signal.userFrustrationSignals ||
    (!signal.clarityReached && signal.sessionExit);

  const loop_closed =
    signal.clarityReached &&
    signal.sessionExit &&
    !signal.requeryWithin30s &&
    !signal.userFrustrationSignals;

  return {
    relief_detected,
    confusion_persisted,
    loop_closed,
  };
}
