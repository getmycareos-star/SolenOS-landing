"use client";

import { useState } from "react";

import type { ContinuityLayerPayload } from "@/lib/identity-continuity";
import { CONTINUITY_RESPONSE_HEADERS } from "@/lib/identity-continuity/contract-constants";
import { TELEMETRY_RESPONSE_HEADERS } from "@/lib/telemetry-persistence/schema";
import type { UiStrings } from "@/lib/i18n";

import { SolenosWordmark } from "@/components/brand";

interface ContinuityPromptProps {
  continuityLayer: ContinuityLayerPayload;
  careSessionId: string | null;
  telemetryUserId: string | null;
  strings: UiStrings;
  onIdentityBound: (params: { userId: string; careSessionId: string }) => void;
}

export function ContinuityPrompt({
  continuityLayer,
  careSessionId,
  telemetryUserId,
  strings,
  onIdentityBound,
}: ContinuityPromptProps) {
  const { continuity_prompt: prompt } = continuityLayer;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (prompt.action === "none" || dismissed) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!careSessionId && prompt.action === "prompt_signup") return;

    setLoading(true);
    setError(null);

    const endpoint =
      prompt.action === "prompt_login" ? "/api/identity/login" : "/api/identity/signup";

    const body =
      prompt.action === "prompt_login"
        ? { email, password, ...(careSessionId ? { care_session_id: careSessionId } : {}) }
        : {
            email,
            password,
            care_session_id: careSessionId,
            ...(telemetryUserId ? { telemetry_user_id: telemetryUserId } : {}),
          };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        error?: string;
        user_id?: string;
        care_session_id?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      const userId =
        data.user_id ?? res.headers.get(TELEMETRY_RESPONSE_HEADERS.userId) ?? telemetryUserId;
      const sessionId =
        data.care_session_id ?? res.headers.get(CONTINUITY_RESPONSE_HEADERS.sessionId) ?? careSessionId;

      if (userId && sessionId) {
        onIdentityBound({ userId, careSessionId: sessionId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="continuity-prompt" aria-live="polite">
      <div className="continuity-prompt-brand">
        <SolenosWordmark size="md" />
      </div>
      <p className="continuity-prompt-message">{prompt.message}</p>
      {prompt.care_graph_summary && (
        <p className="continuity-prompt-context">{prompt.care_graph_summary.what_matters_now}</p>
      )}
      <form className="continuity-prompt-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          <span>{strings.continuityEmailLabel}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          <span>{strings.continuityPasswordLabel}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={prompt.action === "prompt_login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="continuity-prompt-error">{error}</p>}
        <div className="continuity-prompt-actions">
          <button type="submit" disabled={loading}>
            {loading
              ? strings.continuitySaving
              : prompt.action === "prompt_login"
                ? strings.continuityLoginAction
                : strings.continuitySaveAction}
          </button>
          <button type="button" className="continuity-dismiss" onClick={() => setDismissed(true)}>
            {strings.continuityDismiss}
          </button>
        </div>
      </form>
    </aside>
  );
}
