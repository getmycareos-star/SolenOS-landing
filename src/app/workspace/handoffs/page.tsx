"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";

type Recipient = {
  caregiver_id: string;
  name: string;
  relationship: string;
  can_receive_handoff: boolean;
};

type Handoff = {
  id: string;
  status: string;
  scope: string[];
  created_at: string;
  expires_at?: string | null;
  has_summary?: boolean;
  recipients: Array<{ caregiver_id: string; name?: string; role?: string; status: string }>;
};

type DraftRecord = {
  source_type: string;
  source_table: string;
  source_id: string;
  event_at?: string | null;
  recorded_at?: string | null;
  due_at?: string | null;
  epistemic_status?: string;
  record_status?: string;
  stale_warning?: boolean;
  evidence_ids?: string[];
  evidence_reference_status?: string;
  text: string;
  evidence_sources?: Array<{ evidence_id: string; reported_by_label?: string | null; original_author?: string | null; source_type?: string | null; epistemic_status?: string | null }>;
};

type Draft = {
  draft_id: string;
  prepared_at: string;
  read_only: boolean;
  creates_handoff: boolean;
  updates_lcr: boolean;
  source_statuses: Record<string, { status: string; reason?: string; count: number; label?: string }>;
  sections: Array<{ title: string; items: DraftRecord[] }>;
  source_references: Array<{ source_table: string; source_id: string }>;
  limitations: Array<{ source: string; status: string; reason?: string }>;
  warning: string;
};

type SavedSummary = {
  handoff_id: string;
  summary_id: string;
  summary: {
    sections: Record<string, string>;
    source_record_ids: string[];
    content_sha256: string;
    stored_at: string;
    caregiver_reviewed: boolean;
    semantic_grounding_status: string;
  };
};

const SCOPE_OPTIONS = [
  { id: "lcr_summary", label: "Living Care Record summary" },
  { id: "open_loops", label: "Open questions and follow-ups" },
  { id: "appointments", label: "Appointments" },
] as const;

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date not recorded" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function makeSummary(draft: Draft, scope: string[]) {
  const allRecords = draft.sections.flatMap((section) => section.items);
  const openLoopRecords = allRecords.filter((record) => ["actions", "open_questions", "information_gaps"].includes(record.source_table));
  const appointmentRecords = allRecords.filter((record) => record.source_table === "appointments");
  const lcrRecords = allRecords.filter((record) =>
    !["actions", "open_questions", "information_gaps", "appointments"].includes(record.source_table)
  );
  const includedRecords = [
    ...(scope.includes("lcr_summary") ? lcrRecords : []),
    ...(scope.includes("open_loops") ? openLoopRecords : []),
    ...(scope.includes("appointments") ? appointmentRecords : []),
  ];
  const lines = (records: DraftRecord[]) => records.map((record) => {
    const metadata = [
      `Source ${record.source_table}:${record.source_id}`,
      `event time: ${record.event_at || "not recorded"}`,
      `recorded time: ${record.recorded_at || "not recorded"}`,
      `status: ${record.record_status || "not recorded"}`,
      `evidence status: ${record.epistemic_status || "not recorded"}`,
      record.stale_warning ? "source may be older than 30 days" : null,
      record.evidence_reference_status || null,
    ].filter(Boolean).join(" · ");
    const reporter = record.evidence_sources?.map((source) =>
      source.reported_by_label || source.original_author
    ).filter(Boolean).join(", ");
    return `• ${record.text}\n  ${metadata}${reporter ? `\n  Reporter/author: ${reporter}` : ""}${record.evidence_ids?.length ? `\n  Evidence IDs: ${record.evidence_ids.join(", ")}` : ""}`;
  }).join("\n\n");

  const sections: Record<string, string> = {};
  if (scope.includes("lcr_summary")) {
    sections.lcr_summary = lines(lcrRecords) || "No Living Care Record facts, events, or timeline records were returned in the selected preparation window. Review source coverage before sharing.";
  }
  if (scope.includes("open_loops")) {
    sections.open_loops = lines(openLoopRecords) || "No open questions, information gaps, or actions were returned by the available source adapters.";
  }
  if (scope.includes("appointments")) {
    sections.appointments = lines(appointmentRecords) || "No appointment records were returned by the appointment source adapter.";
  }

  const idCounts = new Map<string, number>();
  for (const reference of draft.source_references) {
    idCounts.set(reference.source_id, (idCounts.get(reference.source_id) ?? 0) + 1);
  }
  const sourceRecordIds = [...new Set(
    includedRecords
      .filter((record) => idCounts.get(record.source_id) === 1)
      .map((record) => record.source_id)
  )];
  return { sections, sourceRecordIds };
}

export default function CareHandoffsPage() {
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionPersonId, setSessionPersonId] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientError, setRecipientError] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [scope, setScope] = useState<string[]>(["lcr_summary", "open_loops", "appointments"]);
  const [purpose, setPurpose] = useState("family_transition");
  const [audience, setAudience] = useState<"family" | "professional">("family");
  const [windowDays, setWindowDays] = useState(30);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [outbox, setOutbox] = useState<Handoff[]>([]);
  const [pendingHandoffId, setPendingHandoffId] = useState("");
  const [createUncertain, setCreateUncertain] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SavedSummary | null>(null);
  const [summaryLoadingId, setSummaryLoadingId] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    setRecipientError("");
    try {
      const session = await ensureAnonymousSession();
      setSessionPersonId(session.person.id);
      const outboxResult = await getJSON("/handoffs/outbox") as { items?: Handoff[] };
      setOutbox(outboxResult.items ?? []);
      setCreateUncertain(false);
      try {
        const directory = await getJSON("/handoffs/directory/recipients") as { items?: Recipient[] };
        const available = (directory.items ?? []).filter((item) => item.can_receive_handoff);
        setRecipients(available);
        setSelectedRecipient((current) => available.some((item) => item.caregiver_id === current) ? current : "");
        setRecipientError(available.length ? "" : "No other caregiver with active handoff consent is available on this care record.");
      } catch (cause) {
        setRecipients([]);
        setRecipientError(cause instanceof Error ? cause.message : "The recipient directory is unavailable. Required consent may be missing or revoked.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Care handoffs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const prepareDraft = async () => {
    setPreparing(true);
    setError("");
    setNotice("");
    setDraft(null);
    setSavedSummary(null);
    setReviewed(false);
    try {
      const result = await postJSON("/handoff-drafts/prepare", {
        purpose,
        audience,
        window_days: windowDays,
      }) as Draft;
      if (!result.read_only || result.creates_handoff || result.updates_lcr) {
        throw new Error("The server returned an unexpected handoff draft contract. Nothing was shared.");
      }
      setDraft(result);
      setNotice("Draft prepared from the available saved records. It has not been shared or written to the Living Care Record.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The handoff draft could not be prepared.");
    } finally {
      setPreparing(false);
    }
  };

  const preparedRecordCount = useMemo(
    () => draft?.sections.reduce((total, section) => total + section.items.length, 0) ?? 0,
    [draft],
  );

  const createOrAttachSummary = async () => {
    if (!draft || !reviewed || !selectedRecipient || !scope.length) return;
    setSaving(true);
    setError("");
    setNotice("");
    let handoffId = pendingHandoffId;
    try {
      const session = await ensureAnonymousSession();
      const prepared = makeSummary(draft, scope);
      const totalSummaryCharacters = Object.values(prepared.sections).reduce((total, value) => total + value.length, 0);
      if (totalSummaryCharacters > 20_000) {
        throw new Error("This selected handoff scope exceeds the server's 20,000-character summary limit. Reduce the preparation window or select fewer sections before creating a handoff.");
      }
      if (!handoffId) {
        const created = await postJSON("/handoffs", {
          person_id: session.person.id,
          recipient_caregiver_ids: [selectedRecipient],
          scope,
        }) as Handoff;
        if (!created.id) throw new Error("The backend did not return a handoff ID. Check the handoff outbox before retrying.");
        handoffId = created.id;
        setPendingHandoffId(handoffId);
      }
      const attached = await putJSON(`/handoffs/${encodeURIComponent(handoffId)}/summary`, {
        sections: prepared.sections,
        source_record_ids: prepared.sourceRecordIds,
        caregiver_reviewed: true,
        prepared_at: draft.prepared_at,
      }) as { handoff_id: string; summary_id: string; content_sha256: string };
      if (attached.handoff_id !== handoffId || !attached.summary_id || !attached.content_sha256) {
        throw new Error("The backend did not confirm the persisted summary. The handoff must be checked before retrying.");
      }
      setPendingHandoffId("");
      setNotice("Caregiver-reviewed summary persisted. The recipient can review it in their handoff inbox; the Living Care Record itself was not changed.");
      await loadWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The handoff was not confirmed.");
      if (handoffId) {
        setPendingHandoffId(handoffId);
        try {
          const recovered = await getJSON(`/handoffs/${encodeURIComponent(handoffId)}/summary`) as SavedSummary;
          if (recovered.summary?.content_sha256) {
            setSavedSummary(recovered);
            setPendingHandoffId("");
            setNotice("The server confirms that the summary was persisted. The earlier response was interrupted; the saved summary has now been retrieved and verified.");
          } else {
            setNotice("A handoff record exists, but its summary is not confirmed. Use Retry attach to finish; do not create another handoff.");
          }
        } catch {
          setNotice("A handoff record exists, but its summary could not be confirmed. Use Retry attach to finish; do not create another handoff.");
        }
      } else if (cause instanceof Error && /timed out|failed to fetch|network|load failed/i.test(cause.message)) {
        setCreateUncertain(true);
        setNotice("The create request outcome is unknown. Refresh the saved handoffs before trying again; this prevents accidental duplicate shares.");
      }
    } finally {
      setSaving(false);
    }
  };

  const loadSavedSummary = async (handoffId: string) => {
    setSummaryLoadingId(handoffId);
    setError("");
    try {
      const result = await getJSON(`/handoffs/${encodeURIComponent(handoffId)}/summary`) as SavedSummary;
      if (!result.summary?.content_sha256) throw new Error("The stored handoff summary did not pass the response integrity contract.");
      setSavedSummary(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The persisted summary could not be retrieved.");
    } finally {
      setSummaryLoadingId("");
    }
  };

  return (
    <main className="mobile-screen" style={{ width: "100%", maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px", display: "grid", gap: 18 }}>
      <header>
        <p style={{ margin: "0 0 6px", color: "#64736b", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>CARE COORDINATION</p>
        <h1 style={{ margin: 0, color: "#20372a", fontSize: "clamp(1.6rem, 3vw, 2rem)" }}>Care handoffs</h1>
        <p style={{ margin: "8px 0 0", color: "#5e6d63", lineHeight: 1.6, maxWidth: 720 }}>
          Prepare a source-linked summary for another caregiver on this care record. A handoff is not shared until the backend confirms the recipient, consent, and saved summary.
        </p>
      </header>

      {error && <p role="alert" style={{ margin: 0, padding: 12, border: "1px solid #e5b8b8", borderRadius: 10, background: "#fff7f7", color: "#8b3030" }}>{error}</p>}
      {notice && <p role="status" style={{ margin: 0, padding: 12, border: "1px solid #d8e5d6", borderRadius: 10, background: "#f5faf4", color: "#365b3d" }}>{notice}</p>}

      <section style={{ padding: 16, border: "1px solid #dfe8df", borderRadius: 14, background: "#fff", display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, color: "#26392c" }}>Prepare a handoff draft</h2>
          <p style={{ margin: "5px 0 0", color: "#68766c", fontSize: 12, lineHeight: 1.55 }}>This reads saved records only. It does not create a handoff, send a message, or update LCR facts.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#405343" }}>
            Handoff purpose
            <select value={purpose} onChange={(event) => { setPurpose(event.target.value); setDraft(null); setReviewed(false); }} style={{ minHeight: 40, padding: 8, border: "1px solid #dce6da", borderRadius: 8, background: "#fff" }}>
              <option value="family_transition">Family transition</option>
              <option value="professional_appointment">Professional appointment</option>
              <option value="hospital_discharge">Hospital discharge</option>
              <option value="return_to_care">Return to care</option>
              <option value="period_summary">Period summary</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#405343" }}>
            Intended audience
            <select value={audience} onChange={(event) => { setAudience(event.target.value as "family" | "professional"); setDraft(null); setReviewed(false); }} style={{ minHeight: 40, padding: 8, border: "1px solid #dce6da", borderRadius: 8, background: "#fff" }}>
              <option value="family">Family caregiver</option>
              <option value="professional">Care professional</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#405343" }}>
            Preparation window
            <select value={windowDays} onChange={(event) => { setWindowDays(Number(event.target.value)); setDraft(null); setReviewed(false); }} style={{ minHeight: 40, padding: 8, border: "1px solid #dce6da", borderRadius: 8, background: "#fff" }}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
        <button type="button" onClick={() => void prepareDraft()} disabled={preparing} style={{ minHeight: 42, border: "1px solid #cbdcc9", borderRadius: 9, background: "#e7f0e5", color: "#203b27", fontWeight: 750, cursor: preparing ? "wait" : "pointer" }}>
          {preparing ? "Preparing from saved records…" : "Prepare source-linked draft"}
        </button>
      </section>

      {draft && (
        <section style={{ padding: 16, border: "1px solid #dfe8df", borderRadius: 14, background: "#fff", display: "grid", gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: "#26392c" }}>Review the prepared information</h2>
            <p style={{ margin: "5px 0 0", color: "#68766c", fontSize: 12 }}>Prepared {formatDate(draft.prepared_at)} · {preparedRecordCount} source record(s) returned · {windowDays}-day window</p>
            <p style={{ margin: "8px 0 0", color: "#7a6037", fontSize: 12, lineHeight: 1.55 }}>{draft.warning}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
            {Object.entries(draft.source_statuses).map(([source, status]) => (
              <div key={source} style={{ padding: 9, border: "1px solid #e4eae1", borderRadius: 9 }}>
                <strong style={{ display: "block", fontSize: 11, color: "#405343" }}>{status.label || source.replaceAll("_", " ")}</strong>
                <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "#66756a" }}>{status.status.replaceAll("_", " ")} · {status.count} returned</span>
                {status.reason && <small style={{ display: "block", color: "#7a6037" }}>{status.reason.replaceAll("_", " ")}</small>}
              </div>
            ))}
          </div>
          {draft.limitations.length > 0 && (
            <div style={{ padding: 11, borderRadius: 9, background: "#f8f8f3", color: "#645d4d", fontSize: 12 }}>
              <strong>Sources not included or unavailable</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {draft.limitations.map((item) => <li key={item.source}>{item.source.replaceAll("_", " ")}: {item.status.replaceAll("_", " ")}{item.reason ? ` (${item.reason.replaceAll("_", " ")})` : ""}</li>)}
              </ul>
            </div>
          )}
          {draft.sections.map((section) => (
            <div key={section.title}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#344b39" }}>{section.title} ({section.items.length})</h3>
              {section.items.length ? <ul style={{ margin: 0, paddingLeft: 19, display: "grid", gap: 8 }}>
                {section.items.map((item) => <li key={item.source_table + ":" + item.source_id} style={{ fontSize: 12, lineHeight: 1.5, color: "#46564a" }}>
                  <span>{item.text}</span>
                  <small style={{ display: "block", color: "#778278" }}>Source {item.source_table}:{item.source_id} · Event {formatDate(item.event_at)} · Recorded {formatDate(item.recorded_at)} · {item.epistemic_status || "status not recorded"}{item.stale_warning ? " · older than 30 days" : ""}</small>
                </li>)}
              </ul> : <p style={{ margin: 0, color: "#778278", fontSize: 12 }}>No records returned for this source.</p>}
            </div>
          ))}
          <div style={{ borderTop: "1px solid #e5ebe3", paddingTop: 14, display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#344b39" }}>Persist and share after review</h3>
            <p style={{ margin: 0, color: "#68766c", fontSize: 12, lineHeight: 1.55 }}>Documents are not currently available through the verified handoff-draft source adapter. They are deliberately excluded rather than described as reviewed.</p>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#405343" }}>
              Recipient caregiver
              <select value={selectedRecipient} onChange={(event) => setSelectedRecipient(event.target.value)} disabled={!recipients.length} style={{ minHeight: 40, padding: 8, border: "1px solid #dce6da", borderRadius: 8, background: "#fff" }}>
                <option value="">Choose a caregiver with active consent</option>
                {recipients.map((recipient) => <option key={recipient.caregiver_id} value={recipient.caregiver_id}>{recipient.name} · {recipient.relationship}</option>)}
              </select>
            </label>
            {recipientError && <p role="status" style={{ margin: 0, color: "#7a6037", fontSize: 12 }}>{recipientError}</p>}
            <fieldset style={{ border: "1px solid #e2e9df", borderRadius: 9, padding: 10 }}>
              <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700, color: "#405343" }}>Information scope</legend>
              <div style={{ display: "grid", gap: 8 }}>
                {SCOPE_OPTIONS.map((item) => <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#46564a" }}>
                  <input type="checkbox" checked={scope.includes(item.id)} onChange={(event) => setScope((current) => event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id))} />
                  {item.label}
                </label>)}
              </div>
            </fieldset>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, lineHeight: 1.5, color: "#46564a" }}>
              <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} style={{ marginTop: 2 }} />
              I have reviewed the returned source records, timestamps, status labels, and unavailable-source warnings. I understand that this summary is not independently verified clinical information.
            </label>
            {pendingHandoffId && <p role="status" style={{ margin: 0, color: "#7a6037", fontSize: 12 }}>Handoff {pendingHandoffId} exists without a confirmed summary. Retry attaches the reviewed summary to that same handoff.</p>}
            <button type="button" onClick={() => void createOrAttachSummary()} disabled={saving || createUncertain || !reviewed || !selectedRecipient || !scope.length || !recipients.some((item) => item.caregiver_id === selectedRecipient)} style={{ minHeight: 42, border: "1px solid #cbdcc9", borderRadius: 9, background: "#e7f0e5", color: "#203b27", fontWeight: 750, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saving handoff…" : pendingHandoffId ? "Retry attach reviewed summary" : "Create handoff and save summary"}
            </button>
            {createUncertain && <p role="alert" style={{ margin: 0, color: "#7a6037", fontSize: 12 }}>Creation has an unknown outcome. Refresh the outbox below and resume an incomplete handoff if it appears. Do not submit another create request until the outbox has been checked.</p>}
            <p style={{ margin: 0, fontSize: 11, color: "#778278" }}>Server consent and recipient authorization are mandatory. If the backend rejects the request, no success state will be shown.</p>
          </div>
        </section>
      )}

      <section style={{ padding: 16, border: "1px solid #dfe8df", borderRadius: 14, background: "#fff", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: "#26392c" }}>Shared by this caregiver</h2>
            <p style={{ margin: "5px 0 0", color: "#68766c", fontSize: 12 }}>Persisted handoffs retrieved from the backend.</p>
          </div>
          <button type="button" onClick={() => void loadWorkspace()} disabled={loading} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid #dce6da", borderRadius: 8, background: "#fff", color: "#405343", fontWeight: 700 }}>Refresh</button>
        </div>
        {loading ? <p role="status">Loading saved handoffs…</p> : error && !outbox.length ? <p>Handoff records could not be loaded.</p> : outbox.length ? (
          <div style={{ display: "grid", gap: 9 }}>
            {outbox.map((handoff) => <article key={handoff.id} style={{ padding: 12, border: "1px solid #e4eae1", borderRadius: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 13, color: "#344b39" }}>Handoff {handoff.id.slice(0, 8)}</strong>
                <span style={{ fontSize: 11, color: "#68766c" }}>{handoff.status.replaceAll("_", " ")} · {handoff.has_summary ? "Summary saved" : "No summary attached"}</span>
              </div>
              <p style={{ margin: "6px 0", fontSize: 12, color: "#66756a" }}>Created {formatDate(handoff.created_at)} · Expires {formatDate(handoff.expires_at)}</p>
              <p style={{ margin: "6px 0", fontSize: 12, color: "#66756a" }}>Scope: {handoff.scope.join(", ")}</p>
              <p style={{ margin: "6px 0", fontSize: 12, color: "#66756a" }}>Recipients: {handoff.recipients.map((recipient) => recipient.name || recipient.caregiver_id).join(", ") || "Not listed"}</p>
              {handoff.has_summary ? (
                <button type="button" onClick={() => void loadSavedSummary(handoff.id)} disabled={summaryLoadingId === handoff.id} style={{ marginTop: 5, minHeight: 36, padding: "7px 10px", border: "1px solid #dce6da", borderRadius: 8, background: "#f7faf6", color: "#405343", fontWeight: 700 }}>{summaryLoadingId === handoff.id ? "Retrieving…" : "Retrieve saved summary"}</button>
              ) : (
                <button type="button" onClick={() => { setPendingHandoffId(handoff.id); setCreateUncertain(false); setSelectedRecipient(handoff.recipients[0]?.caregiver_id || ""); setScope(handoff.scope); setReviewed(false); setNotice("Incomplete handoff selected. Prepare or review the current draft, then attach it to this existing handoff."); }} style={{ marginTop: 5, minHeight: 36, padding: "7px 10px", border: "1px solid #dce6da", borderRadius: 8, background: "#f7faf6", color: "#405343", fontWeight: 700 }}>Resume this handoff</button>
              )}
            </article>)}
          </div>
        ) : <p style={{ margin: 0, color: "#68766c", fontSize: 13 }}>No persisted handoffs were returned for this caregiver.</p>}
      </section>

      {savedSummary && (
        <section style={{ padding: 16, border: "1px solid #dfe8df", borderRadius: 14, background: "#fff", display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: "#26392c" }}>Retrieved persisted summary</h2>
          <p style={{ margin: 0, fontSize: 11, color: "#68766c" }}>Summary {savedSummary.summary_id} · Stored {formatDate(savedSummary.summary.stored_at)} · SHA-256 {savedSummary.summary.content_sha256}</p>
          {Object.entries(savedSummary.summary.sections).map(([key, value]) => <div key={key}>
            <h3 style={{ margin: "8px 0 5px", fontSize: 13, color: "#344b39" }}>{key.replaceAll("_", " ")}</h3>
            <pre style={{ margin: 0, padding: 10, borderRadius: 8, background: "#f8faf7", whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: 12, lineHeight: 1.55 }}>{value}</pre>
          </div>)}
          <p style={{ margin: 0, color: "#68766c", fontSize: 11 }}>Caregiver-reviewed attestation: {savedSummary.summary.caregiver_reviewed ? "recorded" : "not recorded"} · Semantic grounding: {savedSummary.summary.semantic_grounding_status}</p>
        </section>
      )}
      <p style={{ margin: 0, color: "#7b867e", fontSize: 11 }}>Care record: {sessionPersonId || "Not loaded"} · This interface does not merge records or infer missing source information.</p>
    </main>
  );
}
