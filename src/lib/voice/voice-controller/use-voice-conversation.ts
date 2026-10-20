"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceConversationState, VoiceConversationTurn } from "../interfaces/voice-controller";
import {
  VoiceConversationController,
  type VoiceConversationControllerOptions,
} from "./conversation-controller";

export type UseVoiceConversationOptions = VoiceConversationControllerOptions;

export function useVoiceConversation(options: UseVoiceConversationOptions = {}) {
  const [state, setState] = useState<VoiceConversationState>("idle");
  const [active, setActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTurn, setLastTurn] = useState<VoiceConversationTurn | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [turns, setTurns] = useState<readonly VoiceConversationTurn[]>([]);
  const controllerRef = useRef<VoiceConversationController | null>(null);

  useEffect(() => {
    const controller = new VoiceConversationController({
      ...options,
      onStateChange: (next) => {
        setState(next);
        if (next !== "processing") {
          setLastHeard(null);
        } else if (controller.lastHeard) {
          setLastHeard(controller.lastHeard);
        }
      },
      onTurn: (turn, turnIndex) => {
        setLastTurn(turn);
        setTurns(controller.turns);
        options.onTurn?.(turn, turnIndex);
      },
      onError: (msg) => {
        setLastError(msg);
        options.onError?.(msg);
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.deactivate();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller recreated when language/ids change
  }, [options.languagePreference, options.telemetryUserId, options.careSessionId]);

  const activate = useCallback(async () => {
    setLastError(null);
    setActive(true);
    await controllerRef.current?.activate();
    setActive(controllerRef.current?.active ?? false);
  }, []);

  const deactivate = useCallback(() => {
    controllerRef.current?.deactivate();
    setActive(false);
    setState("idle");
  }, []);

  const retry = useCallback(() => {
    setLastError(null);
    controllerRef.current?.retry();
  }, []);

  const stateLabel =
    state === "listening"
      ? "Listening…"
      : state === "processing"
        ? "Processing…"
        : state === "responding"
          ? "Responding…"
          : null;

  return {
    state,
    stateLabel,
    active,
    lastError,
    lastTurn,
    lastHeard,
    turns,
    activate,
    deactivate,
    retry,
    isSupported: controllerRef.current?.active !== undefined,
  };
}

export { isBrowserWebSpeechSupported } from "../speech-to-text/browser-web-speech";
