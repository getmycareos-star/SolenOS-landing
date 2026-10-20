"use client";

import { useEffect } from "react";

import type { ActivationSessionContext } from "@/lib/activation-system";
import { dismissPromptType, trackClientActivationEvent } from "@/lib/activation-system/client";

type Props = {
  session: ActivationSessionContext | null;
  onDismiss: () => void;
  onRespond?: () => void;
};

export function ActivationPromptBanner({ session, onDismiss, onRespond }: Props) {
  const promptType = session?.prompt?.type;

  useEffect(() => {
    if (session?.prompt) {
      void trackClientActivationEvent({
        event_type: "PROMPT_OPENED",
        payload: { prompt_type: session.prompt.type },
      });
    }
  }, [session?.prompt?.id, session?.prompt]);

  if (!session?.prompt && !session?.reengagement_message) return null;

  const message = session.prompt?.message ?? session.reengagement_message;
  if (!message) return null;

  return (
    <div className="activation-prompt" role="status">
      <p className="activation-prompt-text">{message}</p>
      <div className="activation-prompt-actions">
        {onRespond && (
          <button
            type="button"
            className="activation-prompt-respond"
            onClick={() => {
              if (promptType) {
                void trackClientActivationEvent({
                  event_type: "PROMPT_RESPONDED",
                  payload: { prompt_type: promptType },
                });
              }
              onRespond();
            }}
          >
            Record something
          </button>
        )}
        <button
          type="button"
          className="linkish activation-prompt-dismiss"
          onClick={() => {
            if (promptType) {
              dismissPromptType(promptType);
              void trackClientActivationEvent({
                event_type: "PROMPT_DISMISSED",
                payload: { prompt_type: promptType },
              });
            }
            onDismiss();
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
