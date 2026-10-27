"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Inbox, RefreshCw, ShieldCheck, Share2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";

type Row = Record<string, unknown>;
type Recipient = { caregiver_id: string; name: string; relationship: string; can_receive_handoff: boolean };
type InboxItem = { id: string; from_caregiver_name: string; scope: string[]; status: string; created_at: string | null; expires_at: string | null; has_summary: boolean };
type OutboxItem = { id: string; status: string; scope: string[]; created_at: string | null; expires_at: string | null; has_summary: boolean; is_expired?: boolean; recipients?: Array<{ caregiver_id: string; name?: string; status?: string }> };
type Snapshot = { sections?: Record<string, unknown>; content_sha256?: string; source_id_validation?: string };

const panel = { border: "1px solid var(--border, #d7ddd7)", borderRadius: 14, padding: 16, marginBottom: 16, background: "var(--surface, #fff)" } as const;
const button = { border: "1px solid var(--border, #cbd5cb)", borderRadius: 9, padding: "10px 14px", background: "#dce9dc", color: "#172117", fontWeight: 650, cursor: "pointer" } as const;
const quietButton = { ...button, background: "transparent", fontWeight: 550 } as const;
const field = { width: "100%", border: "1px solid var(--border, #cbd5cb)", borderRadius: 9, padding: 11, background: "var(--surface, #fff)", color: "var(--foreground, #172117)" } as const;

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}
function textValue(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}
function rowLine(row: Row, keys: string[]) {
  const text = textValue(row, keys);
  if (!text) return "";
  const status = typeof row.epistemic_status === "string" ? ` · status: ${row.epistemic_status}` : "";
  const when = textValue(row, ["effective_at", "occurred_at", "recorded_at", "created_at", "observed_at"]);
  return `${text.slice(0, 650)}${status}${when ? ` · recorded: ${when}` : ""}`;
}
async function buildDraft() {
  const [facts, decisions, questions, gaps, timeline] = await Promise.all([
    getJSON("/care-continuity/facts?limit=25") as Promise<Row[]>,
    getJSON("/care-continuity/decisions?limit=25") as Promise<Row[]>,
    getJSON("/care-continuity/open-questions?limit=25") as Promise<Row[]>,
    getJSON("/care-continuity/information-gaps?limit=25") as Promise<Row[]>,
    getJSON("/care-continuity/timeline?limit=25") as Promise<Row[]>,
  ]);
  const groups = [
    { title: "Care facts", rows: facts, keys: ["fact_value", "description", "title"], max: 12 },
    { title: "Care decisions", rows: decisions, keys: ["decision_text", "title", "description"], max: 8 },
    { title: "Open questions", rows: questions, keys: ["question", "description", "title"], max: 8 },
    { title: "Information gaps", rows: gaps, keys: ["description", "topic", "title"], max: 8 },
    { title: "Recent timeline", rows: timeline, keys: ["summary", "title", "description", "entry_type"], max: 8 },
  ].map(group => ({ title: group.title, items: group.rows.map(row => rowLine(row, group.keys)).filter(Boolean).slice(0, group.max) })).filter(group => group.items.length);
  if (!groups.length) throw new Error("No saved care facts, decisions, questions, gaps, or timeline entries are available. Add real care information first.");
  return [
    "SOLENOS CARE HANDOFF SUMMARY",
    `Prepared for caregiver review: ${new Date().toLocaleString()}`,
    "This summary reflects saved records only. Status labels are preserved where available; missing information is not treated as false.",
    ...groups.flatMap(group => ["", group.title.toUpperCase(), ...group.items.map(item => `• ${item}`)]),
    "",
    "LIMITATIONS",
    "This is a caregiver-reviewed summary, not a clinical judgment. SolenOS stores the reviewed text and an integrity hash; it does not independently verify every statement against source records.",
  ].join("\n").slice(0, 18000);
}

export default function CareHandoffsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState<Recipient[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [inboxError, setInboxError] = useState("");
  const [outboxError, setOutboxError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState("7");
  const [draft, setDraft] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [summaryApproved, setSummaryApproved] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [activeInbox, setActiveInbox] = useState<InboxItem | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const results = await Promise.allSettled([
        getJSON("/handoffs/directory/recipients") as Promise<{ items?: Recipient[] }>,
        getJSON("/handoffs/inbox") as Promise<{ items?: InboxItem[] }>,
        getJSON("/handoffs/outbox") as Promise<{ items?: OutboxItem[] }>,
      ]);
      setDirectory(results[0].status === "fulfilled" ? results[0].value.items ?? [] : []);
      setInbox(results[1].status === "fulfilled" ? results[1].value.items ?? [] : []);
      setOutbox(results[2].status === "fulfilled" ? results[2].value.items ?? [] : []);
      setDirectoryError(results[0].status === "rejected" ? String(results[0].reason?.message ?? results[0].reason) : "");
      setInboxError(results[1].status === "rejected" ? String(results[1].reason?.message ?? results[1].reason) : "");
      setOutboxError(results[2].status === "rejected" ? String(results[2].reason?.message ?? results[2].reason) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The care session could not be verified.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function prepareDraft() {
    setDraftBusy(true); setError(""); setNotice("");
    try { setDraft(await buildDraft()); setDraftReady(true); setSummaryApproved(false); }
    catch (err) { setError(err instanceof Error ? err.message : "The summary could not be prepared from saved records."); }
    finally { setDraftBusy(false); }
  }
  async function createHandoff() {
    if (!draft.trim()) { setError("Prepare and review the summary before sharing."); return; }
    if (!summaryApproved) { setError("Confirm that you reviewed and approve the exact summary before sharing."); return; }
    if (!selected.length) { setError("Select at least one eligible linked caregiver."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const session = await ensureAnonymousSession();
      const expiresAt = new Date(Date.now() + Number(expiryDays) * 86400000).toISOString();
      const created = await postJSON("/handoffs", {
        person_id: session.person.id, recipient_caregiver_ids: selected, scope: ["lcr_summary"], expires_at: expiresAt,
      }) as { id: string };
      try {
        await putJSON(`/handoffs/${created.id}/summary`, {
          sections: { lcr_summary: draft.trim() }, source_record_ids: [], caregiver_reviewed: true, prepared_at: new Date().toISOString(),
        });
      } catch (attachError) {
        try { await postJSON(`/handoffs/${created.id}/revoke`, {}); }
        catch { throw new Error("A handoff was created but its summary could not be attached, and revocation could not be confirmed. Refresh the outbox and revoke it manually."); }
        throw new Error(`The summary could not be attached; SolenOS revoked the empty handoff. ${attachError instanceof Error ? attachError.message : ""}`);
      }
      await load();
      setNotice(`Secure handoff created. It expires ${dateLabel(expiresAt)}. You can revoke it from outgoing handoffs.`);
      setDraft(""); setDraftReady(false); setSummaryApproved(false); setSelected([]);
    } catch (err) { setError(err instanceof Error ? err.message : "The secure handoff could not be created."); }
    finally { setBusy(false); }
  }
  async function revokeHandoff(item: OutboxItem) {
    if (!window.confirm("Revoke this handoff now? Recipients will lose future access to the summary.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await postJSON(`/handoffs/${item.id}/revoke`, {}); await load(); setNotice("Handoff revoked. Recipients can no longer read its summary."); }
    catch (err) { setError(err instanceof Error ? err.message : "The handoff could not be revoked."); }
    finally { setBusy(false); }
  }
  async function reviewIncoming(item: InboxItem) {
    setBusy(true); setError(""); setActiveInbox(item); setSnapshot(null); setReviewConfirmed(false);
    try {
      const result = await getJSON(`/handoffs/${item.id}/summary`) as { summary?: Snapshot };
      setSnapshot(result.summary ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "The shared summary could not be opened."); setActiveInbox(null); }
    finally { setBusy(false); }
  }
  async function acceptAndAcknowledge() {
    if (!activeInbox || !snapshot || !reviewConfirmed) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (activeInbox.status !== "accepted") await postJSON(`/handoffs/${activeInbox.id}/accept`, {});
      await postJSON(`/handoffs/${activeInbox.id}/acknowledge`, { acknowledgement: "I reviewed the caregiver-provided care summary." });
      setNotice("Handoff accepted and your review acknowledgment was recorded.");
      setActiveInbox(null); setSnapshot(null); setReviewConfirmed(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "The handoff acceptance or acknowledgment could not be saved."); }
    finally { setBusy(false); }
  }

  const eligible = directory.filter(recipient => recipient.can_receive_handoff);
  const ineligible = directory.filter(recipient => !recipient.can_receive_handoff);

  return <main className="mobile-screen" style={{ padding: "20px 16px 40px", maxWidth: 920, margin: "0 auto" }}>
    <button type="button" onClick={() => router.push("/workspace")} style={{ ...quietButton, display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}><ArrowLeft size={18} /> Back to Living Care Record</button>
    <header style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ShieldCheck size={25} aria-hidden /><h1 style={{ fontSize: 26, margin: 0 }}>Care handoffs</h1></div>
      <p style={{ lineHeight: 1.6, maxWidth: 720 }}>Share a caregiver-reviewed snapshot with a caregiver already linked to this same care record. Access expires automatically and can be revoked.</p>
    </header>
    {error && <p role="alert" style={{ ...panel, borderColor: "var(--border, #d7ddd7)", color: "var(--foreground, #172117)" }}>{error}</p>}
    {notice && <p role="status" style={{ ...panel, color: "var(--foreground, #172117)" }}>{notice}</p>}

    <section style={panel} aria-labelledby="incoming-heading">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 id="incoming-heading" style={{ margin: 0, fontSize: 19, display: "flex", alignItems: "center", gap: 8 }}><Inbox size={19} /> Incoming handoffs</h2>
        <button type="button" style={quietButton} onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Refresh</button>
      </div>
      {inboxError && <p role="alert">Inbox unavailable: {inboxError}. Check required privacy consent in Settings, then refresh.</p>}
      {!inboxError && !loading && inbox.length === 0 && <p>No incoming handoffs are available for this caregiver session.</p>}
      {inbox.map(item => <article key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12, marginTop: 12 }}>
        <strong>{item.from_caregiver_name || "Another caregiver"}</strong>
        <p style={{ margin: "5px 0", lineHeight: 1.5 }}>Status: {item.status} · Expires: {dateLabel(item.expires_at)}</p>
        <p style={{ margin: "5px 0", fontSize: 13 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Reviewed summary attached" : "Summary not attached"}</p>
        <button type="button" style={button} onClick={() => void reviewIncoming(item)} disabled={busy || !item.has_summary}>Review summary</button>
      </article>)}
    </section>

    {activeInbox && snapshot && <section style={panel} aria-labelledby="review-heading">
      <h2 id="review-heading" style={{ marginTop: 0, fontSize: 19 }}>Review shared summary</h2>
      <p style={{ lineHeight: 1.5 }}>From {activeInbox.from_caregiver_name || "another caregiver"}. This is a caregiver-provided summary, not a clinical verification.</p>
      {Object.entries(snapshot.sections ?? {}).map(([name, value]) => <div key={name} style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>{name.replace(/_/g, " ")}</h3>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", lineHeight: 1.55, margin: 0 }}>{String(value ?? "")}</pre>
      </div>)}
      {snapshot.content_sha256 && <p style={{ fontSize: 12, overflowWrap: "anywhere" }}>Integrity hash: {snapshot.content_sha256}</p>}
      <p style={{ fontSize: 13 }}>Source record IDs: {snapshot.source_id_validation === "not_supplied" ? "not supplied" : "not independently verified by SolenOS"}.</p>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5, margin: "14px 0" }}>
        <input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} />
        <span>I reviewed this caregiver-provided summary. This does not mean every statement is clinically verified.</span>
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={button} disabled={busy || !reviewConfirmed} onClick={() => void acceptAndAcknowledge()}><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{activeInbox.status === "accepted" ? "Record acknowledgment" : "Accept and acknowledge"}</button>
        <button type="button" style={quietButton} onClick={() => { setActiveInbox(null); setSnapshot(null); setReviewConfirmed(false); }}>Close review</button>
      </div>
    </section>}

    <section style={panel} aria-labelledby="share-heading">
      <h2 id="share-heading" style={{ marginTop: 0, fontSize: 19, display: "flex", alignItems: "center", gap: 8 }}><Share2 size={19} /> Create a secure handoff</h2>
      <p style={{ lineHeight: 1.55 }}>SolenOS prepares a draft from saved care facts, decisions, open questions, information gaps and timeline entries. Review and edit it before sharing.</p>
      {directoryError && <p role="alert">Recipient directory unavailable: {directoryError}. Required privacy consent may be missing or revoked.</p>}
      {!directoryError && directory.length === 0 && !loading && <p>No other caregivers are linked to this care record. SolenOS will not send a summary to an unlinked recipient.</p>}
      {eligible.length > 0 && <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
        <legend style={{ fontWeight: 650, marginBottom: 8 }}>Choose recipients</legend>
        {eligible.map(recipient => <label key={recipient.caregiver_id} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 10, lineHeight: 1.4 }}>
          <input type="checkbox" checked={selected.includes(recipient.caregiver_id)} onChange={event => setSelected(current => event.target.checked ? [...current, recipient.caregiver_id] : current.filter(id => id !== recipient.caregiver_id))} />
          <span><strong>{recipient.name}</strong><br /><small>{recipient.relationship || "Caregiver"} · consent verified for handoff</small></span>
        </label>)}
        {ineligible.map(recipient => <p key={recipient.caregiver_id} style={{ fontSize: 13, opacity: 0.8 }}>{recipient.name} — not eligible until required privacy consent is active.</p>)}
      </fieldset>}
      <label htmlFor="handoff-expiry" style={{ display: "block", fontWeight: 650, marginBottom: 6 }}>Access expiry</label>
      <select id="handoff-expiry" style={{ ...field, maxWidth: 260, marginBottom: 14 }} value={expiryDays} onChange={event => setExpiryDays(event.target.value)}>
        <option value="1">24 hours</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
      </select>
      <button type="button" style={button} disabled={draftBusy || loading || busy} onClick={() => void prepareDraft()}>{draftBusy ? "Preparing…" : draftReady ? "Regenerate draft from saved records" : "Prepare summary for review"}</button>
      {draftReady && <>
        <label htmlFor="handoff-draft" style={{ display: "block", fontWeight: 650, margin: "14px 0 6px" }}>Review and edit the summary</label>
        <textarea id="handoff-draft" value={draft} onChange={event => { setDraft(event.target.value); setSummaryApproved(false); }} rows={14} maxLength={18000} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
        <p style={{ fontSize: 12, lineHeight: 1.5 }}>Only saved records are included; the draft is limited to recent entries. Source IDs are not supplied. Sharing creates an immutable reviewed snapshot; create a new handoff to share a changed summary.</p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5, margin: "12px 0" }}>
          <input type="checkbox" checked={summaryApproved} onChange={event => setSummaryApproved(event.target.checked)} />
          <span>I reviewed the exact text above and approve sharing it with the selected caregivers.</span>
        </label>
        <button type="button" style={button} disabled={busy || !draft.trim() || !summaryApproved || !selected.length || !eligible.length} onClick={() => void createHandoff()}><Share2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Saving secure handoff…" : "Share reviewed summary"}</button>
      </>}
    </section>

    <section style={panel} aria-labelledby="outgoing-heading">
      <h2 id="outgoing-heading" style={{ marginTop: 0, fontSize: 19 }}>Outgoing handoffs</h2>
      {outboxError && <p role="alert">Outgoing handoffs unavailable: {outboxError}</p>}
      {!outboxError && !loading && outbox.length === 0 && <p>No outgoing handoffs are recorded for this caregiver session.</p>}
      {outbox.map(item => <article key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12, marginTop: 12 }}>
        <strong>{item.recipients?.map(recipient => recipient.name || "Caregiver").join(", ") || "Caregiver handoff"}</strong>
        <p style={{ margin: "5px 0" }}>Status: {item.status}{item.is_expired ? " · expired" : ""}</p>
        <p style={{ margin: "5px 0", fontSize: 13 }}>Created: {dateLabel(item.created_at)} · Expires: {dateLabel(item.expires_at)}</p>
        <p style={{ margin: "5px 0", fontSize: 13 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Reviewed summary attached" : "No summary attached"}</p>
        {item.status !== "revoked" && !item.is_expired && <button type="button" style={quietButton} disabled={busy} onClick={() => void revokeHandoff(item)}>Revoke access</button>}
      </article>)}
    </section>
    <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}><Clock3 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Revocation blocks future access but cannot retract information a recipient has already viewed or saved.</p>
  </main>;
}
