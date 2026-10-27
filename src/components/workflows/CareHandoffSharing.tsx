"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Inbox, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";

type DraftItem = {
  source_type: string;
  source_table: string;
  source_id: string;
  recorded_at: string | null;
  epistemic_status: string;
  record_status?: string;
  text: string;
  stale_warning?: boolean;
};
type DraftPayload = {
  draft_id: string;
  purpose: string;
  audience?: "family" | "professional";
  prepared_at: string;
  window: { days: number; from: string; to: string };
  sections: Array<{ title: string; items: DraftItem[] }>;
  template_sections?: Array<{ title: string; coverage_status: string; required_fields: string[]; coverage_note: string }>;
  source_statuses: Record<string, { status: string; reason?: string; label?: string; count: number }>;
  source_references: Array<{ source_id: string; source_table: string }>;
  limitations: Array<{ source: string; status: string; reason?: string }>;
  warning: string;
};
type Recipient = { caregiver_id: string; name: string; relationship: string; can_receive_handoff: boolean };
type InboxItem = {
  id: string; from_caregiver_id: string; from_caregiver_name: string;
  from_caregiver_relationship?: string | null; scope: string[]; status: string;
  created_at: string | null; expires_at: string | null; has_summary: boolean;
};
type OutboxItem = {
  id: string; status: string; scope: string[]; created_at: string | null;
  expires_at: string | null; has_summary: boolean; is_expired?: boolean;
  recipients?: Array<{ caregiver_id: string; name?: string; status?: string }>;
};
type Snapshot = {
  sections?: Record<string, string>;
  content_sha256?: string;
  source_id_validation?: string;
};
type Props = {
  draft: DraftPayload | null;
  audience: "family" | "professional" | null;
  purpose: "today" | "appointment" | "overview" | null;
};

const panel: React.CSSProperties = { marginTop: 12, padding: 14, border: "1px solid #dce7dc", borderRadius: 12, background: "#fff" };
const button: React.CSSProperties = { border: "1px solid #cbd8cb", borderRadius: 9, padding: "9px 12px", background: "#dce9dc", color: "#172117", fontWeight: 650, cursor: "pointer" };
const quietButton: React.CSSProperties = { ...button, background: "transparent", fontWeight: 550 };
const field: React.CSSProperties = { width: "100%", border: "1px solid #cbd8cb", borderRadius: 9, padding: 10, color: "#172117", background: "#fff" };

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function buildShareText(draft: DraftPayload, audience: "family" | "professional", purpose: string) {
  const lines = [
    audience === "family" ? "SolenOS Family Care Handoff — Living Care Record · Family Edition" : "SolenOS Professional Care Handoff — Living Care Record · Professional Edition",
    "Purpose: " + purpose,
    "Prepared at: " + formatDate(draft.prepared_at),
    "Source window: " + draft.window.days + " days (" + draft.window.from + " to " + draft.window.to + ")",
    "",
    "IMPORTANT: This is a caregiver-reviewed draft, not independent clinical verification. Missing information is not a negative finding.",
    draft.warning,
    "",
  ];
  const sourceIds: string[] = [];
  let truncated = false;
  for (const section of draft.sections) {
    const sectionHeader = "\n## " + section.title;
    if (lines.join("\n").length + sectionHeader.length > 16500) { truncated = true; break; }
    lines.push(sectionHeader);
    for (const item of section.items) {
      const itemText = [
        "- " + item.text,
        "  Recorded: " + formatDate(item.recorded_at),
        "  Evidence status: " + (item.epistemic_status || "not_recorded"),
        "  Record status: " + (item.record_status || "not_recorded"),
        "  Source: " + item.source_table + "#" + item.source_id,
        item.stale_warning ? "  Freshness: older information; re-check before relying on it" : "",
      ].filter(Boolean).join("\n");
      if (lines.join("\n").length + itemText.length > 16500) { truncated = true; break; }
      lines.push(itemText);
      if (item.source_id && sourceIds.length < 100) sourceIds.push(item.source_id);
    }
    if (truncated) break;
  }
  lines.push("\n## Required handoff sections and coverage");
  const fallbackSections = audience === "family"
    ? ["What matters most right now", "How the person is doing", "How to care for them", "Health and medication information", "What needs to happen next", "Safety and when to seek help", "Family coordination", "Handoff acceptance"]
    : ["Executive summary and current situation", "Relevant history and baseline", "Evidence and provenance register", "Medication reconciliation", "Current clinical and functional assessment", "Active problems, risks, and uncertainty", "Treatment and care plan", "Action register and accountability", "Person-centred and family context", "Transition-specific information", "Contingency planning", "Document and record integrity", "Handoff receipt and acceptance"];
  const templateSections = draft.template_sections ?? fallbackSections.map(title => ({ title, coverage_status: "not_assessed", required_fields: [], coverage_note: "This backend response does not include verified field-level coverage. Review manually; no value has been inferred." }));
  for (const section of templateSections) {
    const line = "- " + section.title + ": " + section.coverage_status.replaceAll("_", " ") + (section.required_fields.length ? ". Required fields: " + section.required_fields.join(", ") : "") + ". " + section.coverage_note;
    if (lines.join("\n").length + line.length > 16500) { truncated = true; break; }
    lines.push(line);
  }
  lines.push("\n## Coverage and limitations");
  for (const [name, value] of Object.entries(draft.source_statuses)) {
    const line = "- " + (value.label || name) + ": " + value.status + (value.reason ? " (" + value.reason + ")" : "") + "; " + value.count + " record(s) returned";
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  for (const limitation of draft.limitations) {
    const line = "- " + limitation.source + ": " + limitation.status + (limitation.reason ? " (" + limitation.reason + ")" : "");
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  if (truncated) lines.push("\nThis summary is truncated to fit the sharing limit. Review the complete draft in AI Companion before relying on it.");
  return { text: lines.join("\n").slice(0, 18000), sourceIds: [...new Set(sourceIds)] };
}

export function CareHandoffSharing({ draft, audience, purpose }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState<Recipient[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState("7");
  const [summaryText, setSummaryText] = useState("");
  const [originalSummaryText, setOriginalSummaryText] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [activeInbox, setActiveInbox] = useState<InboxItem | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [incomingReviewConfirmed, setIncomingReviewConfirmed] = useState(false);

  const eligibleRecipients = useMemo(() => directory.filter(item => item.can_receive_handoff), [directory]);
  const ineligibleRecipients = useMemo(() => directory.filter(item => !item.can_receive_handoff), [directory]);

  const load = useCallback(async () => {
    setLoading(true);
    setDirectoryError(false);
    setHistoryError(false);
    try {
      await ensureAnonymousSession();
      const [directoryResult, inboxResult, outboxResult] = await Promise.allSettled([
        getJSON("/handoffs/directory/recipients") as Promise<{ items?: Recipient[] }>,
        getJSON("/handoffs/inbox") as Promise<{ items?: InboxItem[] }>,
        getJSON("/handoffs/outbox") as Promise<{ items?: OutboxItem[] }>,
      ]);
      if (directoryResult.status === "fulfilled") setDirectory(directoryResult.value.items ?? []);
      else setDirectoryError(true);
      if (inboxResult.status === "fulfilled" && outboxResult.status === "fulfilled") {
        setInbox(inboxResult.value.items ?? []);
        setOutbox(outboxResult.value.items ?? []);
      } else {
        setHistoryError(true);
      }
    } catch {
      setDirectoryError(true);
      setHistoryError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!draft || !audience || !purpose) {
      setSummaryText("");
      setOriginalSummaryText("");
      setSourceIds([]);
      setReviewConfirmed(false);
      return;
    }
    const prepared = buildShareText(draft, audience, purpose === "today" ? "Taking over today" : purpose === "appointment" ? "Doctor's appointment" : "Full care overview");
    setSummaryText(prepared.text);
    setOriginalSummaryText(prepared.text);
    setSourceIds(prepared.sourceIds);
    setReviewConfirmed(false);
  }, [draft, audience, purpose]);

  async function shareReviewedFamilyHandoff() {
    if (!draft || audience !== "family") {
      setError("Professional sharing is unavailable until SolenOS can verify professional identity and role authorization.");
      return;
    }
    if (!reviewConfirmed || !summaryText.trim() || selectedRecipients.length === 0) {
      setError("Review the entire summary and select at least one eligible linked caregiver before sharing.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      const expiresAt = new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
      const created = await postJSON("/handoffs", {
        person_id: session.person.id,
        recipient_caregiver_ids: selectedRecipients,
        scope: ["lcr_summary"],
        expires_at: expiresAt,
      }) as { id: string };
      if (!created?.id) throw new Error("The backend did not confirm a handoff ID. No summary was attached.");
      try {
        await putJSON("/handoffs/" + encodeURIComponent(created.id) + "/summary", {
          sections: { lcr_summary: summaryText.trim() },
          source_record_ids: summaryText.trim() === originalSummaryText.trim() ? sourceIds : [],
          caregiver_reviewed: true,
          prepared_at: new Date().toISOString(),
        });
      } catch {
        try {
          await postJSON("/handoffs/" + encodeURIComponent(created.id) + "/revoke", {});
          throw new Error("The summary could not be attached. SolenOS revoked the empty handoff; refresh the list to confirm.");
        } catch (revokeError) {
          if (revokeError instanceof Error && revokeError.message.startsWith("The summary could not be attached")) throw revokeError;
          throw new Error("The summary could not be attached and automatic revocation could not be confirmed. Refresh the outgoing list and revoke the empty handoff manually.");
        }
      }
      setNotice("Family handoff shared with the selected linked caregiver(s). Access expires " + formatDate(expiresAt) + ". Sharing did not change the Living Care Record.");
      setReviewConfirmed(false);
      setSelectedRecipients([]);
      await load();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "The handoff could not be shared. No success is assumed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: OutboxItem) {
    if (!window.confirm("Revoke this handoff now? Recipients will lose future access to the shared summary.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/handoffs/" + encodeURIComponent(item.id) + "/revoke", {});
      setNotice("Handoff access was revoked. This cannot retract information already viewed or saved by a recipient.");
      await load();
    } catch {
      setError("The handoff could not be revoked. Refresh the outgoing list and verify its current status.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewIncoming(item: InboxItem) {
    setBusy(true);
    setError("");
    setActiveInbox(item);
    setActiveSnapshot(null);
    setIncomingReviewConfirmed(false);
    try {
      const result = await getJSON("/handoffs/" + encodeURIComponent(item.id) + "/summary") as { summary?: Snapshot };
      setActiveSnapshot(result.summary ?? null);
    } catch {
      setError("The shared summary could not be opened. Access may have expired or been revoked.");
      setActiveInbox(null);
    } finally {
      setBusy(false);
    }
  }

  async function acceptIncoming() {
    if (!activeInbox || !activeSnapshot || !incomingReviewConfirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (activeInbox.status !== "accepted") {
        await postJSON("/handoffs/" + encodeURIComponent(activeInbox.id) + "/accept", {});
      }
      await postJSON("/handoffs/" + encodeURIComponent(activeInbox.id) + "/acknowledge", {
        acknowledgement: "I reviewed the caregiver-provided care summary.",
      });
      setNotice("Receipt and review acknowledgment were recorded. This does not verify every statement or complete the listed actions.");
      setActiveInbox(null);
      setActiveSnapshot(null);
      setIncomingReviewConfirmed(false);
      await load();
    } catch {
      setError("Receipt or acceptance could not be recorded. Refresh the incoming list to verify the handoff status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="companion-handoff-sharing" style={{ marginTop: 14, display: "grid", gap: 12 }}>
      {draft && audience === "professional" && (
        <div style={{ ...panel, marginTop: 0, background: "#f7f8f4" }}>
          <strong>Professional handoff — private review only</strong>
          <p style={{ marginBottom: 0, fontSize: 13, lineHeight: 1.55 }}>SolenOS cannot yet verify professional identity and role authorization for handoff recipients. This professional draft cannot be shared from this interface. No family caregiver will be treated as a verified clinician.</p>
        </div>
      )}

      {draft && audience === "family" && (
        <section style={panel} aria-labelledby="family-share-heading">
          <h4 id="family-share-heading" style={{ margin: "0 0 8px", fontSize: 15 }}>Review and share family handoff</h4>
          <p style={{ marginTop: 0, fontSize: 12, lineHeight: 1.55 }}>Only linked, eligible caregiver sessions are listed. Sharing requires explicit review, expires automatically, can be revoked, and does not update the LCR.</p>
          {directoryError && <p role="alert">The recipient list could not be verified. Refresh before sharing.</p>}
          {!directoryError && !loading && eligibleRecipients.length === 0 && <p>No linked caregiver is currently eligible to receive this handoff. SolenOS will not send it to an unlinked recipient.</p>}
          {eligibleRecipients.map(recipient => (
            <label key={recipient.caregiver_id} style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "10px 0", lineHeight: 1.4 }}>
              <input type="checkbox" checked={selectedRecipients.includes(recipient.caregiver_id)} disabled={busy} onChange={event => {
                setSelectedRecipients(current => event.target.checked ? [...current, recipient.caregiver_id] : current.filter(id => id !== recipient.caregiver_id));
                setReviewConfirmed(false);
              }} />
              <span><strong>{recipient.name}</strong><br /><small>{recipient.relationship || "Linked caregiver"} · eligible for handoff</small></span>
            </label>
          ))}
          {ineligibleRecipients.map(recipient => <p key={recipient.caregiver_id} style={{ fontSize: 12, color: "#6b746c" }}>{recipient.name} — not eligible until required consent is active.</p>)}
          <label htmlFor="companion-handoff-expiry" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Access expiry</label>
          <select id="companion-handoff-expiry" value={expiryDays} onChange={event => { setExpiryDays(event.target.value); setReviewConfirmed(false); }} style={{ ...field, maxWidth: 240 }}>
            <option value="1">24 hours</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
          <label htmlFor="companion-handoff-share-text" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Complete summary to be shared</label>
          <textarea id="companion-handoff-share-text" value={summaryText} onChange={event => { setSummaryText(event.target.value); setReviewConfirmed(false); }} rows={12} maxLength={18000} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          <p style={{ fontSize: 11, lineHeight: 1.5, color: "#667267" }}>{summaryText.trim() === originalSummaryText.trim() ? sourceIds.length + " source IDs will be attached as provenance metadata." : "The summary was edited. Source IDs will be omitted so edits are not falsely attributed to the original records."} Review all content. The source IDs do not independently prove every statement.</p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "12px 0", lineHeight: 1.5, fontSize: 12 }}>
            <input type="checkbox" checked={reviewConfirmed} disabled={busy} onChange={event => setReviewConfirmed(event.target.checked)} />
            <span>I reviewed the entire summary against the available care information and approve sharing this snapshot with the selected linked caregiver(s).</span>
          </label>
          <button type="button" style={button} disabled={busy || loading || directoryError || !reviewConfirmed || selectedRecipients.length === 0 || !summaryText.trim()} onClick={() => void shareReviewedFamilyHandoff()}>
            <Share2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Sharing reviewed snapshot…" : "Share reviewed family handoff"}
          </button>
        </section>
      )}

      <section style={{ ...panel, marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Inbox size={17} /><strong>Incoming and outgoing handoffs</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={quietButton} onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />Refresh</button>
            <button type="button" style={quietButton} onClick={() => setShowHistory(value => !value)}>{showHistory ? "Hide handoff history" : "Review handoff history"}</button>
          </div>
        </div>
        {error && <p role="alert" style={{ color: "#8d2d2d", fontSize: 12, lineHeight: 1.5 }}>{error}</p>}
        {notice && <p role="status" style={{ color: "#356441", fontSize: 12, lineHeight: 1.5 }}>{notice}</p>}
        {showHistory && (
          <div style={{ marginTop: 12 }}>
            {historyError && <p role="alert">Handoff history could not be loaded. Refresh and verify connectivity.</p>}
            {!historyError && !loading && inbox.length === 0 && outbox.length === 0 && <p>No incoming or outgoing handoffs are recorded for this session.</p>}
            <h5 style={{ margin: "12px 0 6px" }}>Incoming</h5>
            {inbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.from_caregiver_name || "Linked caregiver"}</strong>
                <p style={{ margin: "4px 0", fontSize: 12 }}>Status: {item.status} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: 12 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                <button type="button" style={button} disabled={busy || !item.has_summary} onClick={() => void reviewIncoming(item)}>Review incoming summary</button>
              </article>
            ))}
            {activeInbox && activeSnapshot && (
              <article style={{ ...panel, margin: "12px 0" }}>
                <h5 style={{ marginTop: 0 }}>Review incoming summary</h5>
                <p style={{ fontSize: 12, lineHeight: 1.5 }}>From {activeInbox.from_caregiver_name || "a linked caregiver"}. This is a caregiver-provided summary, not independent clinical verification.</p>
                {Object.entries(activeSnapshot.sections ?? {}).map(([name, value]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: 12 }}>{name.replaceAll("_", " ")}</strong>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: 12, lineHeight: 1.5 }}>{String(value ?? "")}</pre>
                  </div>
                ))}
                {activeSnapshot.content_sha256 && <p style={{ fontSize: 10, overflowWrap: "anywhere" }}>Integrity hash: {activeSnapshot.content_sha256}</p>}
                <p style={{ fontSize: 11 }}>Source IDs: {activeSnapshot.source_id_validation === "not_supplied" ? "not supplied" : "not independently verified by SolenOS"}.</p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5, margin: "10px 0" }}>
                  <input type="checkbox" checked={incomingReviewConfirmed} onChange={event => setIncomingReviewConfirmed(event.target.checked)} />
                  <span>I reviewed this summary. This does not mean every statement is verified or every action is complete.</span>
                </label>
                <button type="button" style={button} disabled={busy || !incomingReviewConfirmed} onClick={() => void acceptIncoming()}><CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Accept and record receipt</button>
                <button type="button" style={quietButton} onClick={() => { setActiveInbox(null); setActiveSnapshot(null); setIncomingReviewConfirmed(false); }}>Close review</button>
              </article>
            )}
            <h5 style={{ margin: "14px 0 6px" }}>Outgoing</h5>
            {outbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.recipients?.map(recipient => recipient.name || "Caregiver").join(", ") || "Caregiver handoff"}</strong>
                <p style={{ margin: "4px 0", fontSize: 12 }}>Status: {item.status}{item.is_expired ? " · expired" : ""} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: 12 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                {item.status !== "revoked" && !item.is_expired && <button type="button" style={quietButton} disabled={busy} onClick={() => void revoke(item)}>Revoke access</button>}
              </article>
            ))}
          </div>
        )}
        <p style={{ marginBottom: 0, fontSize: 11, color: "#667267", lineHeight: 1.5 }}><Clock3 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Sending is not acceptance. Receipt is recorded separately. Revocation blocks future access but cannot retract information already viewed or saved.</p>
      </section>
    </div>
  );
}
