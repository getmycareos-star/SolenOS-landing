"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";

type CareNotification = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  status?: "active" | "resolved" | "superseded" | "cancelled" | string;
  created_at: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
  resolution_reason?: string | null;
  is_read: boolean;
  read_at: string | null;
};

const panel = {
  border: "1px solid #dce7dc",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
} as const;

const primaryButton = {
  border: "1px solid #cbd8cb",
  borderRadius: 9,
  padding: "8px 11px",
  background: "#dce9dc",
  color: "#172117",
  fontWeight: 650,
  cursor: "pointer",
} as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : date.toLocaleString();
}

function categoryLabel(value: string) {
  if (value === "care_change") return "Care change";
  if (value === "care_attention") return "Care detail";
  if (value === "reminder_due") return "Reminder";
  return "Care update";
}

function lifecycleLabel(item: CareNotification) {
  const status = item.status ?? "active";
  if (status === "superseded") return "Replaced by newer information";
  if (status === "resolved") return "No longer needs attention";
  if (status === "cancelled") return "Cancelled";
  return "Needs attention";
}

function resolutionExplanation(reason?: string | null) {
  if (reason === "source_superseded") return "Newer care information replaced this update.";
  if (reason === "question_resolved") return "The care question has since been resolved.";
  if (reason === "necessity_or_evidence_no_longer_valid") return "The supporting information changed. No response is currently needed.";
  if (reason === "supporting_evidence_unavailable") return "The supporting source is no longer available.";
  if (reason === "change_no_longer_meaningful") return "The latest care review found that this change no longer needs attention.";
  return "The care record has changed since this message was created.";
}

export default function NotificationsPage() {
  const [items, setItems] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const response = await getJSON("/notifications?limit=50&offset=0") as {
        items?: CareNotification[];
      };
      setItems(Array.isArray(response.items) ? response.items : []);
    } catch {
      setError("Care updates could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markAsRead(item: CareNotification) {
    if (item.is_read || savingId) return;
    setSavingId(item.id);
    setError("");
    try {
      const updated = await patchJSON("/notifications/" + encodeURIComponent(item.id) + "/read", {}) as CareNotification;
      setItems(current => current.map(row => row.id === item.id ? { ...row, ...updated, is_read: true } : row));
    } catch {
      setError("This update could not be marked as read. Refresh to check its current status.");
    } finally {
      setSavingId(null);
    }
  }

  const activeCount = items.filter(item => (item.status ?? "active") === "active" && !item.is_read).length;

  return (
    <section className="mobile-screen" aria-labelledby="care-updates-heading" style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 5px", color: "#667267", fontSize: 11, fontWeight: 750, letterSpacing: ".12em" }}>CARE CONTINUITY</p>
          <h1 id="care-updates-heading" style={{ margin: 0, fontSize: 24 }}>Care updates</h1>
          <p style={{ margin: "6px 0 0", color: "#667267", fontSize: 13, lineHeight: 1.5 }}>
            Meaningful changes and care details that genuinely need your attention.
          </p>
        </div>
        <button type="button" style={primaryButton} disabled={refreshing || loading} onClick={() => void load(true)}>
          <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div style={{ ...panel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13 }}>Updates currently needing attention</span>
        <strong aria-live="polite">{activeCount}</strong>
      </div>

      {error && <p role="alert" style={{ margin: 0, color: "#8d2d2d", fontSize: 13 }}>{error}</p>}

      {loading ? (
        <p role="status">Loading care updates…</p>
      ) : items.length === 0 ? (
        <section style={panel}>
          <Bell size={20} aria-hidden="true" />
          <h2 style={{ margin: "8px 0 4px", fontSize: 16 }}>No care updates right now</h2>
          <p style={{ margin: 0, color: "#667267", fontSize: 13, lineHeight: 1.55 }}>
            SolenOS will add an update when saved care information changes meaningfully or a necessary care detail needs your input.
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map(item => {
            const status = item.status ?? "active";
            const active = status === "active";
            return (
              <article key={item.id} style={{ ...panel, borderColor: active && !item.is_read ? "#b8cdb7" : "#dce7dc" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "#667267", fontSize: 11, fontWeight: 700 }}>{categoryLabel(item.category)}</span>
                  <span style={{ fontSize: 11, color: active ? "#355f3a" : "#667267", fontWeight: 650 }}>
                    {lifecycleLabel(item)}
                  </span>
                </div>
                <h2 style={{ margin: "7px 0 5px", fontSize: 15 }}>{item.title}</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.body}</p>
                {!active && <p style={{ margin: "8px 0 0", color: "#667267", fontSize: 12, lineHeight: 1.5 }}>{resolutionExplanation(item.resolution_reason)}</p>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "#667267", fontSize: 11 }}>
                    {formatDate(item.created_at)}{item.is_read ? " · Read" : " · Unread"}
                  </span>
                  {!item.is_read && (
                    <button type="button" style={primaryButton} disabled={savingId !== null} onClick={() => void markAsRead(item)}>
                      <Check size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
                      {savingId === item.id ? "Saving…" : "Mark as read"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p style={{ margin: 0, color: "#667267", fontSize: 12, lineHeight: 1.5 }}>
        Notification timing and quiet hours can be changed in <Link href="/workspace/settings#settings-notifications" style={{ textDecoration: "underline" }}>Settings</Link>.
      </p>
    </section>
  );
}
