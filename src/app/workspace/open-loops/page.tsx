"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Plus, Clock3, AlertCircle, CheckCircle2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";

type LoopHistoryEvent = {
  id: string;
  event_type: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  actor: string;
  created_at: string;
};

type OpenLoop = {
  id: string;
  loop_type: string;
  title: string;
  description: string;
  status: string;
  outcome_status: string;
  priority: string;
  priority_reasons: string[];
  deadline_at: string | null;
  deadline_source: string | null;
  overdue: boolean;
  missing_information: string[];
  evidence: Array<Record<string, unknown>>;
  response_evidence: Array<Record<string, unknown>>;
  outcome_evidence: Array<Record<string, unknown>>;
  blocking_prerequisites: Array<{ id: string; title: string; status: string }>;
  created_at: string;
  updated_at: string;
};

const LOOP_TYPES = [
  ["unresolved_concern", "Unresolved concern"],
  ["pending_decision", "Pending decision"],
  ["pending_action", "Pending action"],
  ["follow_up", "Follow-up"],
  ["unconfirmed_outcome", "Unconfirmed outcome"],
  ["missing_information", "Missing information"],
  ["awaiting_response", "Awaiting response"],
  ["professional_input", "Professional input"],
  ["contradiction", "Conflicting information"],
  ["deferred_decision", "Deferred decision"],
] as const;

function dateLabel(value: string | null): string {
  if (!value) return "No deadline recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Deadline unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

export default function OpenLoopsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [historyById, setHistoryById] = useState<Record<string, LoopHistoryEvent[]>>({});
  const [loopType, setLoopType] = useState<string>("unresolved_concern");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineSource, setDeadlineSource] = useState("explicit_user");
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingActionKeys = useRef<Record<string, { signature: string; key: string }>>({});

  const refresh = useCallback(async () => {
    await ensureAnonymousSession();
    const query = new URLSearchParams({ limit: "100" });
    if (filter !== "all") query.set("status", filter);
    const result = await getJSON(`/open-loops?${query.toString()}`);
    if (!result || !Array.isArray((result as { items?: unknown }).items)) {
      throw new Error("The Open Loops API returned an unexpected response.");
    }
    setLoops((result as { items: OpenLoop[] }).items);
  }, [filter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void refresh()
      .catch(() => {
        if (active) setError("Open Loops could not be loaded from the care record. Check your connection and retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refresh]);

  const visibleLoops = useMemo(() => [...loops].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const rank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
  }), [loops]);

  async function createLoop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await postJSON("/open-loops", {
        loop_type: loopType,
        title: title.trim(),
        description: description.trim(),
        source_type: sourceId.trim() ? "care_record_reference" : null,
        source_id: sourceId.trim() || null,
        evidence: [],
        uncertainty: "unknown",
        idempotency_key: "open-loop-" + crypto.randomUUID(),
        ...(deadline ? { deadline_at: new Date(deadline).toISOString(), deadline_source: deadlineSource, deadline_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}),
      });
      await refresh();
      setTitle("");
      setDescription("");
      setSourceId("");
      setDeadline("");
      setNotice((saved as { recurrence_detected?: boolean }).recurrence_detected
        ? "This occurrence was linked to an existing unresolved issue. Its source occurrence is preserved."
        : "Open loop saved to the care record.");
    } catch (reason) {
      setError("The loop was not saved. " + safeMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(loop: OpenLoop, action: "reassess" | "response" | "action" | "outcome" | "verify" | "reconcile" | "close" | "cancel" | "dependency" | "defer" | "review" | "reopen" | "history") {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    try {
      if (action === "reassess") {
        await postJSON("/open-loops/reassess", {});
      } else if (action === "history") {
        const result = await getJSON(`/open-loops/${encodeURIComponent(loop.id)}/history?limit=100`);
        if (!Array.isArray(result)) throw new Error("The audit history response was invalid.");
        setHistoryById((current) => ({ ...current, [loop.id]: result as LoopHistoryEvent[] }));
      } else if (action === "dependency") {
        const prerequisiteId = window.prompt("Enter the ID of the prerequisite open loop. The backend will verify that it belongs to this same care record and reject dependency cycles.");
        if (!prerequisiteId?.trim()) return;
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/dependencies`, {
          prerequisite_id: prerequisiteId.trim(),
          mandatory: true,
        });
      } else if (action === "defer" || action === "review") {
        const reason = window.prompt(action === "defer"
          ? "Why is this decision being deferred? Record the actual reason."
          : "Why does this inactive item need human review? It will not be marked resolved.");
        if (!reason?.trim()) return;
        await patchJSON(`/open-loops/${encodeURIComponent(loop.id)}`, {
          status: action === "defer" ? "deferred" : "review_abandoned",
          reason: reason.trim(),
          ...(action === "defer" ? { deferred_reason: reason.trim() } : {}),
        });
      } else {
        const text = action === "response" ? window.prompt("Record the actual response received. Do not invent a response.") :
          action === "action" ? window.prompt("Record the action actually taken. Do not imply an outcome unless it was observed.") :
          action === "outcome" ? window.prompt("Record the outcome that was reported.") :
          action === "verify" ? window.prompt("Describe the verification actually performed.") :
          action === "reconcile" ? window.prompt("Record the explicit reconciliation decision. Preserve disagreement if it remains unresolved.") :
          action === "close" ? window.prompt("Describe the evidence supporting closure. This will not bypass backend verification.") :
          action === "reopen" ? window.prompt("Why is this closed or cancelled loop being reopened?") :
          window.prompt("Why are you cancelling further pursuit? Cancellation is not resolution.");
        if (!text?.trim()) return;
        const verificationRule = action === "verify"
          ? window.prompt("What explicit criterion was used to verify the outcome?")
          : null;
        if (action === "verify" && !verificationRule?.trim()) return;
        const signature = JSON.stringify({
          action,
          text: text.trim(),
          verification_rule: verificationRule?.trim() || null,
        });
        const pendingKey = loop.id + ":" + action;
        const pending = pendingActionKeys.current[pendingKey];
        const idempotencyKey = pending?.signature === signature ? pending.key : crypto.randomUUID();
        pendingActionKeys.current[pendingKey] = { signature, key: idempotencyKey };
        const payload = {
          text: text.trim(),
          evidence: [{ kind: "caregiver_recorded", text: text.trim(), recorded_at: new Date().toISOString() }],
          ...(verificationRule?.trim() ? { verification_rule: verificationRule.trim() } : {}),
          idempotency_key: idempotencyKey,
        };
        const endpoint = action === "response" ? "responses" : action === "action" ? "actions" : action === "outcome" ? "outcomes" : action === "verify" ? "verify-outcome" : action === "reconcile" ? "reconcile" : action === "close" ? "close" : action === "reopen" ? "reopen" : "cancel";
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/${endpoint}`, payload);
        delete pendingActionKeys.current[pendingKey];
      }
      await refresh();
      setNotice(action === "reassess" ? "Reassessment completed by the backend." : "The backend accepted the update. Review the current status below.");
    } catch (reason) {
      setError("The requested change was not confirmed. " + safeMessage(reason));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="mobile-screen" style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 56px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/workspace" style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
          <ArrowLeft size={18} aria-hidden /> Back to Living Care Record
        </Link>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, opacity: 0.7 }}>CARE CONTINUITY</p>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.15, margin: "8px 0" }}>Open Loops</h1>
        <p style={{ maxWidth: 660, lineHeight: 1.6 }}>Keep unresolved concerns, decisions, actions and follow-ups visible. Acknowledging an item does not mean its outcome has been verified.</p>
      </header>

      <form onSubmit={createLoop} style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 16, padding: 18, marginBottom: 24, display: "grid", gap: 14 }}>
        <h2 style={{ fontSize: 20, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Plus size={19} aria-hidden /> Track an unresolved item</h2>
        <label style={{ display: "grid", gap: 6 }}>Type
          <select value={loopType} onChange={(event) => setLoopType(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }}>
            {LOOP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>Short title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={240} placeholder="What still needs attention?" style={{ minHeight: 44, padding: 10, borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Context and what is known
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={12000} rows={4} placeholder="Separate what was observed, what was reported, and what remains uncertain." style={{ padding: 10, borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Source reference (optional)
          <input value={sourceId} onChange={(event) => setSourceId(event.target.value)} maxLength={160} placeholder="Existing event or evidence ID, if known" style={{ minHeight: 44, padding: 10, borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Deadline (optional; leave blank if none is established)
          <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }} />
        </label>
        {deadline && <label style={{ display: "grid", gap: 6 }}>Why this deadline exists
          <select value={deadlineSource} onChange={(event) => setDeadlineSource(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }}>
            <option value="explicit_user">Explicitly entered by caregiver</option>
            <option value="recorded_commitment">Recorded commitment</option>
            <option value="system_policy">Documented system policy</option>
          </select>
        </label>}
        <Button type="submit" variant="primary" disabled={saving || !title.trim() || !description.trim()}>{saving ? "Saving…" : "Save open loop"}</Button>
      </form>

      <section aria-labelledby="open-loop-list-heading">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 id="open-loop-list-heading" style={{ fontSize: 22, margin: 0 }}>Your tracked items</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select aria-label="Filter open loops" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ minHeight: 40, padding: 8, borderRadius: 8 }}>
              <option value="open">Open</option><option value="waiting">Waiting</option><option value="deferred">Deferred</option><option value="blocked">Blocked</option><option value="review_abandoned">Needs review</option><option value="closed">Verified closed</option><option value="cancelled">Cancelled</option><option value="all">All statuses</option>
            </select>
            <Button variant="secondary" onClick={() => { setLoading(true); void refresh().catch(() => setError("Could not refresh Open Loops.")).finally(() => setLoading(false)); }} disabled={loading}>
              <RefreshCw size={16} aria-hidden /> Refresh
            </Button>
          </div>
        </div>

        {error && <p role="alert" style={{ border: "1px solid #b91c1c", padding: 12, borderRadius: 10 }}>{error}</p>}
        {notice && <p role="status" style={{ border: "1px solid #a3b18a", padding: 12, borderRadius: 10 }}>{notice}</p>}
        {loading ? <p aria-live="polite">Loading saved open loops…</p> :
          visibleLoops.length === 0 ? <div style={{ border: "1px dashed var(--border, #d6d9d3)", borderRadius: 14, padding: 24 }}>
            <CheckCircle2 size={22} aria-hidden /><h3>No items in this view</h3><p>No sample records are shown. If this is unexpected, refresh and check that the correct caregiver session is active.</p>
          </div> : <div style={{ display: "grid", gap: 14 }}>
            {visibleLoops.map((loop) => <article key={loop.id} style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.75 }}>{loop.loop_type.replaceAll("_", " ")} · {loop.status.replaceAll("_", " ")}</p>
                  <h3 style={{ margin: "0 0 8px", fontSize: 19 }}>{loop.title}</h3>
                </div>
                <strong>{loop.priority.toUpperCase()}</strong>
              </div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{loop.description}</p>
              <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                <Clock3 size={15} aria-hidden /> {dateLabel(loop.deadline_at)}
                {loop.overdue && <strong style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><AlertCircle size={15} aria-hidden /> Overdue</strong>}
              </p>
              {loop.priority_reasons.length > 0 && <p style={{ fontSize: 13 }}>Why it is flagged: {loop.priority_reasons.join("; ")}</p>}
              {loop.blocking_prerequisites.length > 0 && <p style={{ fontSize: 13 }}>Blocked by: {loop.blocking_prerequisites.map((item) => item.title).join(", ")}</p>}
              {loop.missing_information.length > 0 && <p style={{ fontSize: 13 }}>Still missing: {loop.missing_information.join(", ")}</p>}
              <p style={{ fontSize: 12, opacity: 0.75 }}>Outcome: {loop.outcome_status.replaceAll("_", " ")} · Updated {dateLabel(loop.updated_at)}</p>
              {historyById[loop.id] && <section aria-label={`Audit history for ${loop.title}`} style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-muted, #f6f7f4)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Recorded history</h4>
                {historyById[loop.id].length === 0 ? <p style={{ margin: 0, fontSize: 13 }}>No audit events were returned.</p> :
                  <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                    {historyById[loop.id].map((event) => <li key={event.id} style={{ fontSize: 13 }}>
                      <strong>{event.event_type.replaceAll("_", " ")}</strong> · {dateLabel(event.created_at)}
                      {event.evidence.length > 0 && <p style={{ margin: "4px 0 0" }}>Evidence recorded: {event.evidence.map((item) => String(item.kind ?? item.text ?? "source")).join(", ")}</p>}
                    </li>)}
                  </ol>}
              </section>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reassess")}>Reassess</Button>
                <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "history")}>View audit history</Button>
                {(loop.loop_type === "awaiting_response" || loop.loop_type === "professional_input" || loop.loop_type === "follow_up") && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "response")}>Record response</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "action")}>Record action</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "outcome")}>Record outcome</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "verify")}>Verify outcome</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "dependency")}>Add prerequisite</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "defer")}>Defer decision</Button>}
                {["open", "waiting"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "review")}>Flag for review</Button>}
                {loop.loop_type === "contradiction" && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reconcile")}>Record reconciliation</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "close")}>Attempt closure</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "cancel")}>Cancel pursuit</Button>}
                {["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reopen")}>Reopen with reason</Button>}
              </div>
            </article>)}
          </div>}
      </section>
    </main>
  );
}
