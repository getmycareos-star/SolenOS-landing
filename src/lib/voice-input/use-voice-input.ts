"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { InputProvenance } from "../care-events/types";
import { defaultBrowserVoiceCapture } from "./browser-capture";
import type { VoiceCaptureState } from "./types";
import { isVoiceInputAvailable } from "./types";

const TEXT_PROVENANCE: InputProvenance = { input_type: "text" };

export type UseVoiceInputOptions = {
  value: string;
  onChange: (value: string) => void;
  onProvenanceChange?: (provenance: InputProvenance) => void;
};

export type UseVoiceInputResult = {
  voiceAvailable: boolean;
  state: VoiceCaptureState;
  provenance: InputProvenance;
  toggleListening: () => void;
  stopListening: () => void;
  markTypedInput: () => void;
};

/**
 * Voice input layer hook — feature-detect on mount, one-shot capture, silent errors.
 */
export function useVoiceInput({
  value,
  onChange,
  onProvenanceChange,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [state, setState] = useState<VoiceCaptureState>("idle");
  const [provenance, setProvenance] = useState<InputProvenance>(TEXT_PROVENANCE);
  const captureRef = useRef(defaultBrowserVoiceCapture);

  useEffect(() => {
    setVoiceAvailable(isVoiceInputAvailable());
  }, []);

  const updateProvenance = useCallback(
    (next: InputProvenance) => {
      setProvenance(next);
      onProvenanceChange?.(next);
    },
    [onProvenanceChange],
  );

  const stopListening = useCallback(() => {
    captureRef.current.stop();
    setState("idle");
  }, []);

  const markTypedInput = useCallback(() => {
    updateProvenance(TEXT_PROVENANCE);
  }, [updateProvenance]);

  const startListening = useCallback(() => {
    const started = captureRef.current.start({
      onPartial: (text) => onChange(text),
      onComplete: (result) => {
        onChange(result.transcript);
        updateProvenance(result.provenance);
      },
      onEnd: () => setState("idle"),
    });

    if (started) {
      setState("listening");
    }
  }, [onChange, updateProvenance]);

  const toggleListening = useCallback(() => {
    if (state === "listening") {
      stopListening();
      return;
    }
    startListening();
  }, [startListening, state, stopListening]);

  useEffect(() => () => captureRef.current.stop(), []);

  return {
    voiceAvailable,
    state,
    provenance,
    toggleListening,
    stopListening,
    markTypedInput,
  };
}
