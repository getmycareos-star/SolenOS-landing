"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getAnonymousAccessToken } from "@/api/client";
import { apiUrl, safeJson } from "@/lib/api-url";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

type HandoffInboxItem = {
  id: string;
  from_caregiver_id: string;
  from_caregiver_name: string;
  from_caregiver_relationship: string;
  scope: string[];
  status: "pending" | "accepted" | string;
  created_at: string | null;
  expires_at: string | null;
  has_summary: boolean;
  acknowledged: boolean;
};

type HandoffSummarySnapshot = {
  sections: Record<string, string>;
  source_record_ids: string[];
  source_id_validation: "not_supplied" | "not_server_verified" | string;
  review_attestation: string;
  caregiver_reviewed: boolean;
  prepared_at: string | null;
  stored_at: string;
  content_sha256: string;
};

type HandoffInboxResponse = { items: HandoffInboxItem[]; count: number };
type HandoffSummaryResponse = { handoff_id: string; summary_id: string; summary: HandoffSummarySnapshot };

type ActionName = "refresh" | "review" | "accept" | "acknowledge" | null;

async function requestJson<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!getAnonymousAccessToken()) {
    throw new Error("Open the saved care record before reviewing handoffs.");
  }
  const session = await ensureAnonymousSession();
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await safeJson(response) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not complete the handoff action.");
  }
  return data;
}

const SECTION_LABELS: Record<string, string> = {
  lcr_summary: "Living Care Record summary",
  open_loops: "Open questions and follow-ups",
  appointments: "Appointments",
  documents: "Documents",
};

export function CareHandoffInboxPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<HandoffInboxItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [selectedHandoffId, setSelectedHandoffId] = useState<string | null>(null);
  const [summary, setSummary] = useState<HandoffSummarySnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<ActionName>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedHandoff = useMemo(
    () => items.find((item) => item.id === selectedHandoffId) ?? null,
    [items, selectedHandoffId],
  );

  const loadInbox = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const result = await requestJson<HandoffInboxResponse>("/api/v1/handoffs/inbox");
      setItems(Array.isArray(result.items) ? result.items : []);
      setLoadState("ready");
    } catch (e) {
      setError(sanitizeCaregiverErrorMessage(e instanceof Error ? e.message : "Could not load handoffs."));
      setLoadState("failed");
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const reviewSummary = useCallback(async (handoffId: string) => {
    setSelectedHandoffId(handoffId);
    setSummary(null);
    setError(null);
    setBusyAction("review");
    try {
      const result = await requestJson<HandoffSummaryResponse>(
        `/api/v1/handoffs/${encodeURIComponent(handoffId)}/summary`,
      );
      setSummary(result.summary);
    } catch (e) {
      setError(sanitizeCaregiverErrorMessage(e instanceof Error ? e.message : "Could not load the handoff summary."));
    } finally {
      setBusyAction(null);
    }
  }, []);

  const acceptHandoff = useCallback(async () => {
    if (!selectedHandoffId) return;
    setBusyAction("accept");
    setError(null);
    try {
      await requestJson(
        `/api/v1/handoffs/${encodeURIComponent(selectedHandoffId)}/accept`,
        "POST",
      );
      await loadInbox();
    } catch (e) {
      setError(sanitizeCaregiverErrorMessage(e instanceof Error ? e.message : "Could not accept this handoff."));
    } finally {
      setBusyAction(null);
    }
  }, [selectedHandoffId, loadInbox]);

  const acknowledgeHandoff = useCallback(async () => {
    if (!selectedHandoffId) return;
    setBusyAction("acknowledge");
    setError(null);
    try {
      await requestJson(
        `/api/v1/handoffs/${encodeURIComponent(selectedHandoffId)}/acknowledge`,
        "POST",
        { acknowledgement: "I have reviewed and received this care handoff." },
      );
      await loadInbox();
    } catch (e) {
      setError(sanitizeCaregiverErrorMessage(e instanceof Error ? e.message : "Could not acknowledge this handoff."));
    } finally {
      setBusyAction(null);
    }
  }, [selectedHandoffId, loadInbox]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="share-care-summary-overlay" role="dialog" aria-modal="true" aria-label="Care handoff inbox">
      <div className="share-care-summary-panel">
        <div className="share-panel-header">
          <div className="share-panel-header-left">
            <Inbox size={20} aria-hidden />
            <div>
              <h2 className="share-panel-title">Care handoff inbox</h2>
              <p className="share-panel-subtitle">Review a caregiver's summary before accepting the handoff.</p>
            </div>
          </div>
          <div className="share-panel-header-actions">
            <Button variant="icon" onClick={() => void loadInbox()} disabled={loadState === "loading"} aria-label="Refresh handoffs">
              <RefreshCw size={18} aria-hidden />
            </Button>
            <Button variant="icon" onClick={close} aria-label="Close handoff inbox">
              <X size={18} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="share-panel-body">
          {loadState === "loading" && (
            <div className="share-loading">
              <Loader2 className="spin" size={28} aria-hidden />
              <p>Loading incoming handoffs…</p>
            </div>
          )}

          {loadState === "failed" && (
            <div className="share-error-card">
              <h3 className="share-error-title">Handoffs could not be loaded</h3>
              {error && <p className="share-error-message" role="alert">{error}</p>}
              <Button variant="primary" onClick={() => void loadInbox()}>Try again</Button>
            </div>
          )}

          {loadState === "ready" && items.length === 0 && (
            <div className="share-readiness-card">
              <h3 className="share-readiness-title">No incoming handoffs</h3>
              <p className="share-readiness-message">When another linked caregiver sends a handoff, it will appear here.</p>
              <Button variant="secondary" onClick={close}>Done</Button>
            </div>
          )}

          {loadState === "ready" && items.length > 0 && (
            <div className="care-handoff-inbox-list">
              {items.map((item) => (
                <article className="share-review-section" key={item.id}>
                  <div className="share-review-section-heading-row">
                    <h3 className="share-review-section-heading">{item.from_caregiver_name}</h3>
                    <span className="share-status-pill">{item.status === "accepted" ? "Accepted" : "Pending"}</span>
                  </div>
                  <p className="share-panel-muted">
                    {item.from_caregiver_relationship} · {item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"}
                  </p>
                  <p>Included scope: {item.scope.map((scope) => SECTION_LABELS[scope] ?? scope).join(", ") || "Not specified"}.</p>
                  {!item.has_summary && <p role="status">The sender has not attached a reviewed summary yet.</p>}
                  <div className="share-readiness-actions">
                    <Button
                      variant="secondary"
                      disabled={!item.has_summary || busyAction !== null}
                      onClick={() => void reviewSummary(item.id)}
                    >
                      Review summary
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {selectedHandoff && summary && (
            <section className="care-handoff-summary-review" aria-label="Handoff summary review">
              <h3 className="share-success-title">Summary from {selectedHandoff.from_caregiver_name}</h3>
              <p className="share-panel-muted">
                Caregiver-reviewed snapshot. SolenOS has not independently verified the summary statements or source IDs.
              </p>
              {Object.entries(summary.sections).map(([key, value]) => (
                <section className="share-review-section" key={key}>
                  <h4 className="share-review-section-heading">{SECTION_LABELS[key] ?? key}</h4>
                  <p style={{ whiteSpace: "pre-wrap" }}>{value}</p>
                </section>
              ))}
              <p className="share-panel-muted">
                {summary.source_record_ids.length
                  ? "Source IDs were supplied by the sending caregiver but have not been verified."
                  : "No source record IDs were supplied with this summary."}
              </p>
              <p className="share-panel-muted">Snapshot integrity check: passed.</p>
              <div className="share-readiness-actions">
                {selectedHandoff.status === "pending" && (
                  <Button variant="primary" onClick={() => void acceptHandoff()} loading={busyAction === "accept"} disabled={busyAction !== null}>
                    Accept handoff
                  </Button>
                )}
                {selectedHandoff.status === "accepted" && !selectedHandoff.acknowledged && (
                  <Button variant="primary" onClick={() => void acknowledgeHandoff()} loading={busyAction === "acknowledge"} disabled={busyAction !== null}>
                    Acknowledge receipt
                  </Button>
                )}
                {selectedHandoff.acknowledged && (
                  <p className="share-success-message"><CheckCircle2 size={16} aria-hidden /> Receipt acknowledged.</p>
                )}
              </div>
            </section>
          )}

          {error && loadState !== "failed" && <p className="share-panel-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
