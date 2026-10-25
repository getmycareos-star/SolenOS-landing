"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";

type CareNotification = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  source_event_id: string | null;
  created_at: string | null;
  is_read: boolean;
  read_at: string | null;
};

export default function WorkspaceNotificationsPage() {
  const [items, setItems] = useState<CareNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const [feed, unread] = await Promise.all([
        getJSON("/notifications?limit=100&offset=0") as Promise<{ items: CareNotification[] }>,
        getJSON("/notifications/unread-count") as Promise<{ unread_count: number }>,
      ]);
      setItems(feed.items);
      setUnreadCount(unread.unread_count);
    } catch {
      setError("We couldn't load your notifications. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: CareNotification) => {
    if (item.is_read) return;
    setBusyId(item.id);
    setError("");
    try {
      const updated = await patchJSON(`/notifications/${encodeURIComponent(item.id)}/read`, {}) as CareNotification;
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError("We couldn't update this notification. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="workspace-page">
      <div className="mobile-settings-card">
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" asChild><Link href="/workspace"><ArrowLeft size={16} /> Back to workspace</Link></Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
        <h1 className="workspace-headline mt-5"><Bell size={22} className="inline-block mr-2" />Notifications</h1>
        <p className="mobile-settings-hint">Updates for this care record. Unread: {unreadCount}.</p>
        {error && <div role="alert" className="mobile-settings-hint"><p>{error}</p><Button variant="secondary" onClick={() => void load()} disabled={loading}>Try again</Button></div>}
        {loading ? <p role="status" className="mobile-settings-hint">Loading notifications…</p> :
          items.length === 0 ? <p className="mobile-settings-hint">No notifications have been recorded for this care record.</p> :
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="mobile-settings-card" aria-label={item.title}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="mobile-settings-label">{item.title}</h2>
                    <p className="mobile-settings-hint">{item.body}</p>
                    <p className="mobile-settings-hint">{item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"} · {item.priority} · {item.category}</p>
                  </div>
                  {!item.is_read && <span className="rounded-full border px-2 py-1 text-xs">Unread</span>}
                </div>
                {!item.is_read && <div className="mobile-settings-actions"><Button variant="secondary" disabled={busyId === item.id} loading={busyId === item.id} onClick={() => void markRead(item)}><Check size={15} /> Mark as read</Button></div>}
              </article>
            ))}
          </div>}
        <div className="mobile-settings-actions mt-4"><Button variant="secondary" asChild><Link href="/workspace/settings">Notification settings</Link></Button></div>
      </div>
    </main>
  );
}
