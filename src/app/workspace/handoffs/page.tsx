"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Inbox, RefreshCw, ShieldCheck, Share2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";


type Recipient = {
  caregiver_id: string;
  name: string;
  relationship: string;
  can_receive_handoff: boolean;
};
type InboxItem = {
  id: string;
  from_caregiver_id: string;
  from_caregiver_name: string;
  from_caregiver_relationship?: string | null;
  scope: string[];
  status: "pending" | "accepted" | string;
  created_at: string | null;
  expires_at: string | null;
  has_summary: boolean;
};
type OutboxItem = {
  id: string;
  status: string;
  scope: string[];
  created_at: string | null;
  expires_at: string | null;
  has_summary: boolean;
  is_expired?: boolean;
  recipients?: Array<{ caregiver_id: string; name?: string; status?: string }>;
};
type HandoffSnapshot = {
  sections?: Record<string, unknown>;
  content_sha256?: string;
  review_attestation?: string;
  source_id_validation?: string;
  caregiver_reviewed?: boolean;
  prepared_at?: string | null;
};

const panelStyle = {
  border: "1px solid var(--border, #d7ddd7)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
  background: "var(--surface, #fff)",
} as const;
const buttonStyle = {
  border: "1px solid var(--border, #cbd5cb)",
  borderRadius: 9,
  padding: "10px 14px",
  background: "#dce9dc",
  color: "#172117",
  fontWeight: 650,
  cursor: "pointer",
} as const;
const mutedButtonStyle = {
  ...buttonStyle,
  background: "transparent",
  fontWeight: 550,
} as const;
const fieldStyle = {
  width: "100%",
  border: "1px solid var(--border, #cbd5cb)",
  borderRadius: 9,
  padding: 11,
  background: "var(--surface, #fff)",
  color: "var(--foreground, #172117)",
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

type PreparedHandoffDraft = {
  draft_id: string;
  purpose: string;
  prepared_at: string;
  window: { days: number; from: string; to: string };
  source_statuses: Record<string, { status: string; reason?: string; label?: string; count: number }>;
  sections: Array<{ title: string; items: Array<{ source_type: string; source_table: string; source_id: string; recorded_at: string | null; epistemic_status: string; text: string; stale_warning: boolean }> }>;
  source_references: Array<{ source_type: string; source_table: string; source_id: string; recorded_at: string | null; epistemic_status: string; stale_warning: boolean }>;
  limitations: Array<{ source: string; status: string; reason?: string }>;
  warning: string;
};

async function buildReviewedDraft(purpose: string, windowDays: number): Promise<{ text: string; sourceRecordIds: string[] }> {
  const prepared = await postJSON("/handoff-drafts/prepare", {
    purpose,
    window_days: windowDays,
  }) as PreparedHandoffDraft;

  const lines = [
    "SOLENOS CARE HANDOFF DRAFT",
    `Purpose: ${prepared.purpose.replaceAll("_", " ")}`,
    `Prepared: ${new Date(prepared.prepared_at).toLocaleString()}`,
    `Records window: ${prepared.window.days} days (${new Date(prepared.window.from).toLocaleDateString()} – ${new Date(prepared.window.to).toLocaleDateString()})`,
    "",
    "SAVED CARE RECORDS",
  ];
  for (const section of prepared.sections ?? []) {
    lines.push("", section.title);
    for (const item of section.items ?? []) {
      const when = item.recorded_at ? `; recorded ${item.recorded_at}` : "; time not recorded";
      const status = item.epistemic_status && item.epistemic_status !== "not_recorded" ? `; status ${item.epistemic_status}` : "; status not recorded";
      const stale = item.stale_warning ? "; WARNING: record may be stale" : "";
      lines.push(`- ${item.text} [source ${item.source_table}/${item.source_id}${when}${status}${stale}]`);
    }
  }
  lines.push("", "SOURCE AVAILABILITY");
  for (const [name, source] of Object.entries(prepared.source_statuses ?? {})) {
    lines.push(`- ${source.label ?? name}: ${source.status}${source.reason ? ` (${source.reason})` : ""}; records returned: ${source.count}`);
  }
  lines.push("", "LIMITATIONS / MISSING SOURCES");
  if (prepared.limitations?.length) {
    for (const item of prepared.limitations) lines.push(`- ${item.source}: ${item.status}${item.reason ? ` — ${item.reason}` : ""}`);
  } else {
    lines.push("- No unavailable sources reported by the backend.");
  }
  lines.push("", prepared.warning, "Caregiver review required. This draft does not itself create or share a handoff.");
  return {
    text: lines.join("\n"),
    sourceRecordIds: [...new Set((prepared.source_references ?? []).map(item => item.source_id).filter(Boolean))],
  };
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
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState("7");
  const [draft, setDraft] = useState("");
  const [preparedDraft, setPreparedDraft] = useState("");
  const [draftSourceRecordIds, setDraftSourceRecordIds] = useState<string[]>([]);
  const [draftReviewConfirmed, setDraftReviewConfirmed] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [activeInbox, setActiveInbox] = useState<InboxItem | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<HandoffSnapshot | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const autoPrepareStarted = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const [directoryResult, inboxResult, outboxResult] = await Promise.allSettled([
        getJSON("/handoffs/directory/recipients") as Promise<{ items?: Recipient[] }>,
        getJSON("/handoffs/inbox") as Promise<{ items?: InboxItem[] }>,
        getJSON("/handoffs/outbox") as Promise<{ items?: OutboxItem[] }>,
      ]);
      setDirectory(directoryResult.status === "fulfilled" ? directoryResult.value.items ?? [] : []);
      setInbox(inboxResult.status === "fulfilled" ? inboxResult.value.items ?? [] : []);
      setOutbox(outboxResult.status === "fulfilled" ? outboxResult.value.items ?? [] : []);
      setDirectoryError(directoryResult.status === "rejected" ? String(directoryResult.reason?.message ?? directoryResult.reason) : "");
      setInboxError(inboxResult.status === "rejected" ? String(inboxResult.reason?.message ?? inboxResult.reason) : "");
      setOutboxError(outboxResult.status === "rejected" ? String(outboxResult.reason?.message ?? outboxResult.reason) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The care session could not be verified.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoPrepareStarted.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("prepare") !== "1") return;
    autoPrepareStarted.current = true;
    const rawPurpose = params.get("purpose") ?? "family_transition";
    const allowedPurposes = new Set(["family_transition", "professional_appointment", "hospital_discharge", "return_to_care", "period_summary"]);
    const parsedDays = Number.parseInt(params.get("window_days") ?? "30", 10);
    const windowDays = Number.isFinite(parsedDays) ? Math.min(90, Math.max(1, parsedDays)) : 30;
    void prepareDraft(allowedPurposes.has(rawPurpose) ? rawPurpose : "family_transition", windowDays);
    // One-time Companion-to-review workflow handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function prepareDraft(purpose = "family_transition", windowDays = 30) {
    setDraftBusy(true);
    setError("");
    setNotice("");
    try {
      const prepared = await buildReviewedDraft(purpose, windowDays);
      setDraft(prepared.text);
      setPreparedDraft(prepared.text);
      setDraftSourceRecordIds(prepared.sourceRecordIds);
      setDraftReviewConfirmed(false);
      setDraftReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The care summary could not be prepared from saved records.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function createHandoff() {
    if (!draft.trim()) {
      setError("Prepare and review the summary before sharing.");
      return;
    }
    if (!draftReviewConfirmed) {
      setError("Confirm that you have reviewed the summary before sharing it.");
      return;
    }
    if (selectedRecipients.length === 0) {
      setError("Select at least one linked caregiver who is eligible to receive a handoff.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let handoffId = "";
    try {
      const session = await ensureAnonymousSession();
      const expiresAt = new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
      const created = await postJSON("/handoffs", {
        person_id: session.person.id,
        recipient_caregiver_ids: selectedRecipients,
        scope: ["lcr_summary"],
        expires_at: expiresAt,
      }) as { id: string };
      handoffId = created.id;
      try {
        await putJSON(`/handoffs/${handoffId}/summary`, {
          sections: { lcr_summary: draft.trim() },
          // If the caregiver edits the generated text, do not imply the original
          // source list still proves the edited content. The backend also labels
          // source IDs as unverified and does not treat them as established facts.
          source_record_ids: draft.trim() === preparedDraft.trim() ? draftSourceRecordIds : [],
          caregiver_reviewed: true,
          prepared_at: new Date().toISOString(),
        });
      } catch (attachError) {
        try {
          await postJSON(`/handoffs/${handoffId}/revoke`, {});
        } catch {
          throw new Error("A handoff was created but its summary could not be attached, and automatic revocation could not be confirmed. Refresh the outbox and revoke it manually.");
        }
        throw new Error(`The summary could not be attached, so SolenOS revoked the empty handoff. ${attachError instanceof Error ? attachError.message : ""}`);
      }
      await load();
      setNotice(`Secure handoff created. It expires ${formatDate(expiresAt)}. You can revoke it from the outgoing handoffs list.`);
      setDraft("");
      setPreparedDraft("");
      setDraftSourceRecordIds([]);
      setDraftReviewConfirmed(false);
      setDraftReady(false);
      setSelectedRecipients([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The secure handoff could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeHandoff(item: OutboxItem) {
    if (!window.confirm("Revoke this handoff now? Recipients will lose access to the shared summary.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON(`/handoffs/${item.id}/revoke`, {});
      await load();
      setNotice("Handoff revoked. Recipients can no longer read its summary.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The handoff could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewIncoming(item: InboxItem) {
    setBusy(true);
    setError("");
    setNotice("");
    setActiveInbox(item);
    setActiveSnapshot(null);
    setReviewConfirmed(false);
    try {
      const result = await getJSON(`/handoffs/${item.id}/summary`) as { summary?: HandoffSnapshot };
      setActiveSnapshot(result.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The shared summary could not be opened.");
      setActiveInbox(null);
    } finally {
      setBusy(false);
    }
  }

  async function acceptAndAcknowledge() {
    if (!activeInbox || !activeSnapshot || !reviewConfirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (activeInbox.status !== "accepted") {
        await postJSON(`/handoffs/${activeInbox.id}/accept`, {});
      }
      await postJSON(`/handoffs/${activeInbox.id}/acknowledge`, {
        acknowledgement: "I reviewed the caregiver-provided care summary.",
      });
      setNotice("Handoff accepted and your review acknowledgment was recorded.");
      setActiveInbox(null);
      setActiveSnapshot(null);
      setReviewConfirmed(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The handoff acceptance or acknowledgment could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const eligibleRecipients = directory.filter(item => item.can_receive_handoff);
  const ineligibleRecipients = directory.filter(item => !item.can_receive_handoff);

  return (
    <main className="mobile-screen" style={{ padding: "20px 16px 40px", maxWidth: 920, margin: "0 auto" }}>
      <button type="button" onClick={() => router.push("/workspace")} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <ArrowLeft size={18} /> Back to Living Care Record
      </button>

      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={25} aria-hidden />
          <h1 style={{ fontSize: 26, margin: 0 }}>Care handoffs</h1>
        </div>
        <p style={{ lineHeight: 1.6, maxWidth: 720 }}>
          Share a caregiver-reviewed snapshot with a caregiver already linked to this same care record. Access expires automatically and can be revoked.
        </p>
      </header>

      {error && <p role="alert" style={{ ...panelStyle, borderColor: "#b45309", color: "#92400e" }}>{error}</p>}
      {notice && <p role="status" style={{ ...panelStyle, color: "#14532d" }}>{notice}</p>}

      <section style={panelStyle} aria-labelledby="incoming-handoffs-heading">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 id="incoming-handoffs-heading" style={{ margin: 0, fontSize: 19, display: "flex", alignItems: "center", gap: 8 }}><Inbox size={19} /> Incoming handoffs</h2>
          <button type="button" style={mutedButtonStyle} onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Refresh</button>
        </div>
        {inboxError && <p role="alert">Inbox unavailable: {inboxError}. Check required privacy consent in Settings, then refresh.</p>}
        {!inboxError && !loading && inbox.length === 0 && <p>No incoming handoffs are available for this caregiver session.</p>}
        {inbox.map(item => (
          <article key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12, marginTop: 12 }}>
            <strong>{item.from_caregiver_name || "Another caregiver"}</strong>
            <p style={{ margin: "5px 0", lineHeight: 1.5 }}>Status: {item.status} · Expires: {formatDate(item.expires_at)}</p>
            <p style={{ margin: "5px 0", fontSize: 13 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Reviewed summary attached" : "Summary not attached"}</p>
            <button type="button" style={buttonStyle} onClick={() => void reviewIncoming(item)} disabled={busy || !item.has_summary}>Review summary</button>
          </article>
        ))}
      </section>

      {activeInbox && activeSnapshot && (
        <section style={panelStyle} aria-labelledby="incoming-summary-heading">
          <h2 id="incoming-summary-heading" style={{ marginTop: 0, fontSize: 19 }}>Review shared summary</h2>
          <p style={{ lineHeight: 1.5 }}>From {activeInbox.from_caregiver_name || "another caregiver"}. Review the contents before accepting. This is a caregiver-provided summary, not a clinical verification.</p>
          {Object.entries(activeSnapshot.sections ?? {}).map(([name, value]) => (
            <div key={name} style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, marginBottom: 6 }}>{name.replaceAll("_", " ")}</h3>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", lineHeight: 1.55, margin: 0 }}>{String(value ?? "")}</pre>
            </div>
          ))}
          {activeSnapshot.content_sha256 && <p style={{ fontSize: 12, overflowWrap: "anywhere" }}>Integrity hash: {activeSnapshot.content_sha256}</p>}
          <p style={{ fontSize: 13 }}>Source record IDs: {activeSnapshot.source_id_validation === "not_supplied" ? "not supplied" : "not independently verified by SolenOS"}.</p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5, margin: "14px 0" }}>
            <input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} />
            <span>I have reviewed this caregiver-provided summary. This acknowledgment does not mean every statement is clinically verified.</span>
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={buttonStyle} disabled={busy || !reviewConfirmed} onClick={() => void acceptAndAcknowledge()}><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{activeInbox.status === "accepted" ? "Record acknowledgment" : "Accept and acknowledge"}</button>
            <button type="button" style={mutedButtonStyle} onClick={() => { setActiveInbox(null); setActiveSnapshot(null); setReviewConfirmed(false); }}>Close review</button>
          </div>
        </section>
      )}

      <section style={panelStyle} aria-labelledby="share-handoff-heading">
        <h2 id="share-handoff-heading" style={{ marginTop: 0, fontSize: 19, display: "flex", alignItems: "center", gap: 8 }}><Share2 size={19} /> Create a secure handoff</h2>
        <p style={{ lineHeight: 1.55 }}>SolenOS prepares a draft from saved care facts, decisions, open questions, information gaps and timeline entries. You must review and can edit it before sharing.</p>
        {directoryError && <p role="alert">Recipient directory unavailable: {directoryError}. Required privacy consent may be missing or revoked.</p>}
        {!directoryError && directory.length === 0 && !loading && <p>No other caregivers are linked to this care record yet. SolenOS will not send a summary to an unlinked recipient.</p>}
        {eligibleRecipients.length > 0 && (
          <fieldset style={{ border: "0", padding: 0, margin: "12px 0" }}>
            <legend style={{ fontWeight: 650, marginBottom: 8 }}>Choose recipients</legend>
            {eligibleRecipients.map(recipient => (
              <label key={recipient.caregiver_id} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 10, lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={selectedRecipients.includes(recipient.caregiver_id)}
                  onChange={event => {
                    setSelectedRecipients(current => event.target.checked ? [...current, recipient.caregiver_id] : current.filter(id => id !== recipient.caregiver_id));
                    setDraftReviewConfirmed(false);
                  }}
                />
                <span><strong>{recipient.name}</strong><br /><small>{recipient.relationship || "Caregiver"} · consent verified for handoff</small></span>
              </label>
            ))}
            {ineligibleRecipients.map(recipient => (
              <p key={recipient.caregiver_id} style={{ fontSize: 13, opacity: 0.8 }}>{recipient.name} — not eligible until required privacy consent is active.</p>
            ))}
          </fieldset>
        )}
        <label style={{ display: "block", fontWeight: 650, marginBottom: 6 }} htmlFor="handoff-expiry">Access expiry</label>
        <select id="handoff-expiry" style={{ ...fieldStyle, maxWidth: 260, marginBottom: 14 }} value={expiryDays} onChange={event => { setExpiryDays(event.target.value); setDraftReviewConfirmed(false); }}>
          <option value="1">24 hours</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
        </select>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} disabled={draftBusy || loading || busy} onClick={() => void prepareDraft()}>{draftBusy ? "Preparing…" : draftReady ? "Regenerate draft from saved records" : "Prepare summary for review"}</button>
        </div>
        {draftReady && (
          <>
            <label htmlFor="handoff-summary-draft" style={{ display: "block", fontWeight: 650, margin: "14px 0 6px" }}>Review and edit the summary</label>
            <textarea id="handoff-summary-draft" value={draft} onChange={event => { setDraft(event.target.value); setDraftReviewConfirmed(false); }} rows={14} maxLength={18000} style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5 }} />
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>Only saved records are included; the draft is limited to the most recent records returned by each section. {draft.trim() === preparedDraft.trim() ? `${draftSourceRecordIds.length} source record ID(s) will be attached as unverified provenance metadata.` : "You edited the generated draft, so source IDs are omitted rather than implying your edits are verified against the original records."} SolenOS does not independently verify that every statement is supported by its source IDs. Sharing creates an immutable reviewed snapshot; to change it later, create a new handoff.</p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5, margin: "12px 0" }}>
              <input type="checkbox" checked={draftReviewConfirmed} onChange={event => setDraftReviewConfirmed(event.target.checked)} />
              <span>I have reviewed this entire summary, checked it against the care information available to me, and approve sharing this snapshot with the selected caregiver(s). I understand that SolenOS does not independently verify every statement.</span>
            </label>
            <button type="button" style={buttonStyle} disabled={busy || !draft.trim() || !draftReviewConfirmed || selectedRecipients.length === 0 || eligibleRecipients.length === 0} onClick={() => void createHandoff()}><Share2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Saving secure handoff…" : "Share reviewed summary"}</button>
          </>
        )}
      </section>

      <section style={panelStyle} aria-labelledby="outgoing-handoffs-heading">
        <h2 id="outgoing-handoffs-heading" style={{ marginTop: 0, fontSize: 19 }}>Outgoing handoffs</h2>
        {outboxError && <p role="alert">Outgoing handoffs unavailable: {outboxError}</p>}
        {!outboxError && !loading && outbox.length === 0 && <p>No outgoing handoffs are recorded for this caregiver session.</p>}
        {outbox.map(item => (
          <article key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12, marginTop: 12 }}>
            <strong>{item.recipients?.map(recipient => recipient.name || "Caregiver").join(", ") || "Caregiver handoff"}</strong>
            <p style={{ margin: "5px 0" }}>Status: {item.status}{item.is_expired ? " · expired" : ""}</p>
            <p style={{ margin: "5px 0", fontSize: 13 }}>Created: {formatDate(item.created_at)} · Expires: {formatDate(item.expires_at)}</p>
            <p style={{ margin: "5px 0", fontSize: 13 }}>Scope: {item.scope.join(", ")} · {item.has_summary ? "Reviewed summary attached" : "No summary attached"}</p>
            {item.status !== "revoked" && !item.is_expired && (
              <button type="button" style={mutedButtonStyle} disabled={busy} onClick={() => void revokeHandoff(item)}>Revoke access</button>
            )}
          </article>
        ))}
      </section>

      <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}><Clock3 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Access expires automatically. Revocation blocks future access but cannot retract information a recipient has already viewed or saved.</p>
    </main>
  );
}
