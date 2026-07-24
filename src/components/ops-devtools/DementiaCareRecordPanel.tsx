"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CARE_CONTEXT_TYPES,
  DEMENTIA_STAGES,
  DRIVING_STATUSES,
  DEMENTIA_STAGE_LABELS,
  DRIVING_STATUS_LABELS,
  FINANCIAL_RISK_LABEL,
  MEDICATION_RISK_LABELS,
  MEDICATION_RISK_LEVELS,
  SUNDOWNING_WARNING,
  formatSundowningWindow,
  type CareContextType,
  type DementiaContext,
  type DementiaProfileView,
} from "@/lib/care-contexts";

type Props = {
  className?: string;
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function DementiaCareRecordPanel({ className }: Props) {
  const [profile, setProfile] = useState<DementiaProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [wanderDesc, setWanderDesc] = useState("");
  const [wanderTrigger, setWanderTrigger] = useState("");
  const [wanderLocation, setWanderLocation] = useState("");
  const [finDesc, setFinDesc] = useState("");
  const [sundownStart, setSundownStart] = useState("");
  const [sundownEnd, setSundownEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/care-contexts/dementia");
      const data = (await res.json()) as { care_profile?: DementiaProfileView; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load care record");
      setProfile(data.care_profile ?? null);
      const ctx = data.care_profile?.dementia_context;
      if (ctx?.sundowning_window) {
        setSundownStart(ctx.sundowning_window.start);
        setSundownEnd(ctx.sundowning_window.end);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/care-contexts/dementia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { care_profile?: DementiaProfileView; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setProfile(data.care_profile ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function postEvent(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/care-contexts/dementia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { care_profile?: DementiaProfileView; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to record");
      setProfile(data.care_profile ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record");
    } finally {
      setSaving(false);
    }
  }

  const ctx: DementiaContext | null =
    profile?.care_context === "dementia" ? profile.dementia_context : null;

  return (
    <section
      className={`dementia-care-record${className ? ` ${className}` : ""}`}
      aria-label="Care context record"
    >
      <div className="dementia-care-record-inner">
        <h3 className="dementia-care-record-title">Care context</h3>
        <p className="dementia-care-record-note">
          Extension layer — stored for your record only. No diagnosis or predictions.
        </p>

        {loading && <p className="dementia-care-record-muted">Loading…</p>}
        {error && (
          <p className="dementia-care-record-error" role="alert">
            {error}
          </p>
        )}

        {profile && (
          <>
            <label className="dementia-field">
              <span>Care context</span>
              <select
                value={profile.care_context}
                disabled={saving}
                onChange={(e) => void patch({ care_context: e.target.value as CareContextType })}
              >
                {CARE_CONTEXT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value === "general"
                      ? "General"
                      : value === "dementia"
                        ? "Dementia"
                        : "Future condition"}
                  </option>
                ))}
              </select>
            </label>

            {profile.care_context === "dementia" && ctx && (
              <div className="dementia-context-fields">
                <label className="dementia-field">
                  <span>Dementia stage</span>
                  <select
                    value={ctx.dementia_stage}
                    disabled={saving}
                    onChange={(e) => void patch({ dementia_stage: e.target.value })}
                  >
                    {DEMENTIA_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {DEMENTIA_STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="dementia-fieldset">
                  <legend>Sundowning window</legend>
                  <div className="dementia-inline-fields">
                    <label>
                      Start
                      <input
                        type="time"
                        value={sundownStart}
                        disabled={saving}
                        onChange={(e) => setSundownStart(e.target.value)}
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="time"
                        value={sundownEnd}
                        disabled={saving}
                        onChange={(e) => setSundownEnd(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="dementia-secondary-btn"
                      disabled={saving || !sundownStart || !sundownEnd}
                      onClick={() =>
                        void patch({
                          sundowning_window: { start: sundownStart, end: sundownEnd },
                        })
                      }
                    >
                      Save window
                    </button>
                  </div>
                  {ctx.sundowning_window && (
                    <p className="dementia-warning">
                      {formatSundowningWindow(ctx.sundowning_window)} — {SUNDOWNING_WARNING}
                    </p>
                  )}
                </fieldset>

                <label className="dementia-field">
                  <span>Medication supervision</span>
                  <select
                    value={ctx.medication_risk}
                    disabled={saving}
                    onChange={(e) => void patch({ medication_risk: e.target.value })}
                  >
                    {MEDICATION_RISK_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {MEDICATION_RISK_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </label>

                {profile.current_medications.length > 0 && (
                  <div className="dementia-med-list">
                    <h4>Medications on record</h4>
                    <ul>
                      {profile.current_medications.map((med) => (
                        <li key={med}>
                          {med}
                          <span className="dementia-med-risk">
                            {MEDICATION_RISK_LABELS[ctx.medication_risk]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <label className="dementia-field">
                  <span>Driving status</span>
                  <select
                    value={ctx.driving_status}
                    disabled={saving}
                    onChange={(e) => void patch({ driving_status: e.target.value })}
                  >
                    {DRIVING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {DRIVING_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>

                {ctx.driving_status_history.length > 0 && (
                  <div className="dementia-event-list">
                    <h4>Driving status history</h4>
                    <ul>
                      {ctx.driving_status_history
                        .slice()
                        .reverse()
                        .map((entry) => (
                          <li key={`${entry.recorded_at}-${entry.status}`}>
                            <time dateTime={entry.recorded_at}>
                              {formatTimestamp(entry.recorded_at)}
                            </time>
                            <span>{DRIVING_STATUS_LABELS[entry.status]}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <fieldset className="dementia-fieldset">
                  <legend>Wandering incidents</legend>
                  <label className="dementia-field">
                    <span>Description</span>
                    <input
                      type="text"
                      value={wanderDesc}
                      disabled={saving}
                      placeholder="Tried to leave house at 8pm"
                      onChange={(e) => setWanderDesc(e.target.value)}
                    />
                  </label>
                  <label className="dementia-field">
                    <span>Trigger (optional)</span>
                    <input
                      type="text"
                      value={wanderTrigger}
                      disabled={saving}
                      onChange={(e) => setWanderTrigger(e.target.value)}
                    />
                  </label>
                  <label className="dementia-field">
                    <span>Location (optional)</span>
                    <input
                      type="text"
                      value={wanderLocation}
                      disabled={saving}
                      onChange={(e) => setWanderLocation(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="dementia-secondary-btn"
                    disabled={saving || !wanderDesc.trim()}
                    onClick={() => {
                      void postEvent({
                        action: "wandering",
                        description: wanderDesc,
                        trigger: wanderTrigger || undefined,
                        location: wanderLocation || undefined,
                      }).then(() => {
                        setWanderDesc("");
                        setWanderTrigger("");
                        setWanderLocation("");
                      });
                    }}
                  >
                    Record incident
                  </button>
                  {ctx.wandering_events.length > 0 && (
                    <ul className="dementia-event-list-items">
                      {ctx.wandering_events.map((event) => (
                        <li key={event.id}>
                          <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
                          <p>{event.description}</p>
                          {event.trigger && (
                            <p className="dementia-care-record-muted">Trigger: {event.trigger}</p>
                          )}
                          {event.location && (
                            <p className="dementia-care-record-muted">Location: {event.location}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>

                <fieldset className="dementia-fieldset">
                  <legend>{FINANCIAL_RISK_LABEL} observations</legend>
                  <label className="dementia-field">
                    <span>Observation</span>
                    <input
                      type="text"
                      value={finDesc}
                      disabled={saving}
                      placeholder="Unknown caller requested account details"
                      onChange={(e) => setFinDesc(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="dementia-secondary-btn"
                    disabled={saving || !finDesc.trim()}
                    onClick={() => {
                      void postEvent({
                        action: "financial_risk",
                        description: finDesc,
                      }).then(() => setFinDesc(""));
                    }}
                  >
                    Record observation
                  </button>
                  {ctx.possible_financial_risk_events.length > 0 && (
                    <ul className="dementia-event-list-items">
                      {ctx.possible_financial_risk_events.map((event) => (
                        <li key={event.id}>
                          <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
                          <p>{event.description}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
