"use client";

import { apiUrl, safeJson } from "@/lib/api-url";
import { ensureAnonymousSession } from "@/api/client";
import { useState } from "react";

type Props = {
  caregiverId: string;
  careSessionId: string;
  onSaved: (displayName: string) => void;
  /** Skip without blocking capture — first-time Locked B. */
  onSkip?: () => void;
};

/**
 * Ask-once: what to call the care recipient (MVP identity naming).
 * Never silently infer Mom/Dad into identity.
 * Shown after first successful capture — not as pre-capture onboarding.
 */
export function CareRecipientNameGate({
  caregiverId,
  careSessionId,
  onSaved,
  onSkip,
}: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter the name or preferred label for the person receiving care.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      const res = await fetch(apiUrl("/api/situation"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          person_id: session.person.id,
          caregiver_id: session.caregiver.id,
          display_name: trimmed,
        }),
      });
      const data = (await safeJson(res)) as {
        error?: string;
        care_recipient_display_name?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      onSaved(data.care_recipient_display_name ?? trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel panel-input care-recipient-name-gate" aria-label="Who this record is for">
      <h2 className="workspace-headline">Who is this Living Care Record about?</h2>
      <p className="workspace-lede">
        What should we call the person this Care Reality is about? You can change this later.
      </p>
      <label className="sr-only" htmlFor="care-recipient-display-name">
        Name for the person receiving care
      </label>
      <input
        id="care-recipient-display-name"
        className="brain-dump"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name or preferred label"
        autoComplete="off"
        disabled={saving}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      />
      {error && <p className="workspace-error">{error}</p>}
      <div className="situation-actions">
        <button
          type="button"
          className="workspace-primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save name"}
        </button>
        {onSkip && (
          <button
            type="button"
            className="workspace-secondary"
            disabled={saving}
            onClick={onSkip}
          >
            Skip for now
          </button>
        )}
      </div>
    </section>
  );
}
