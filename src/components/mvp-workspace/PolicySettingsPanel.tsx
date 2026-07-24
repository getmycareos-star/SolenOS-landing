"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  caregiverId: string;
};

export function PolicySettingsPanel({ caregiverId }: Props) {
  const [dataImprovement, setDataImprovement] = useState(false);
  const [verified, setVerified] = useState(false);
  const [limitedMode, setLimitedMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/policy/consent?user_id=${encodeURIComponent(caregiverId)}`);
      const data = (await res.json()) as {
        verified?: boolean;
        profile?: { data_improvement_consent?: boolean; limited_mode?: boolean };
      };
      setVerified(Boolean(data.verified));
      setDataImprovement(Boolean(data.profile?.data_improvement_consent));
      setLimitedMode(Boolean(data.profile?.limited_mode));
    } finally {
      setLoading(false);
    }
  }, [caregiverId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleImprovement(enabled: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/policy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: caregiverId,
          action: "update_data_improvement",
          data_improvement_consent: enabled,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      setDataImprovement(enabled);
      setMessage(enabled ? "System improvement enabled." : "Strict privacy mode — no improvement use.");
    } catch {
      setMessage("Could not update data improvement preference.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/policy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: caregiverId, action: "revoke" }),
      });
      if (!res.ok) throw new Error("Revoke failed");
      await load();
      setMessage("Consent revoked — limited mode active. New care events are blocked.");
    } catch {
      setMessage("Could not revoke consent.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section className="policy-settings-panel">
      <h4>Data &amp; system improvement</h4>
      <p className="panel-muted">
        Control how solenos uses de-identified care patterns to improve continuity and safety.
      </p>

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={!verified || limitedMode || saving}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>Allow system improvement using my data</span>
      </label>

      <div className="policy-settings-actions">
        <button
          type="button"
          className="workspace-secondary"
          disabled={!verified || saving}
          onClick={() => void revoke()}
        >
          Revoke consent (limited mode)
        </button>
      </div>

      {message && <p className="panel-muted">{message}</p>}
    </section>
  );
}
