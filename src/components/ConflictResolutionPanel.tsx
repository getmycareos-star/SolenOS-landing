"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";
import { caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";

type Conflict = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  description: string;
  context_key?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  resolution_status: string;
  resolution_notes?: string | null;
  resolution_scope?: string | null;
  unresolved_remainder?: string | null;
  evidence_ids?: string[] | null;
  matching_candidate_ids?: string[];
};
type Evidence = { id: string; person_id: string; type: string; source_text: string };
type ResolutionEvent = {
  id: string;
  contradiction_id: string;
  person_id: string;
  actor_caregiver_id?: string | null;
  previous_status: string;
  new_status: string;
  rationale: string;
  resolution_scope?: string | null;
  unresolved_remainder?: string | null;
  evidence_ids: string[];
  created_at: string;
};

const panel: CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 10, padding: 14,
  marginTop: 12, background: "var(--surface)",
};
const field: CSSProperties = {
  boxSizing: "border-box", width: "100%", padding: "9px 10px", borderRadius: 7,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};
const button: CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px",
  background: "var(--surface)", color: "var(--text)", cursor: "pointer",
};
const statuses = ["unresolved", "partially_resolved", "qualified", "resolved", "superseded", "reopened"] as const;

export default function ConflictResolutionPanel({ personId }: { personId?: string }) {
  const [scopedPersonId, setScopedPersonId] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("unresolved");
  const [rationale, setRationale] = useState("");
  const [scope, setScope] = useState("");
  const [unresolvedRemainder, setUnresolvedRemainder] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [history, setHistory] = useState<ResolutionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = conflicts.find((item) => item.id === selectedId);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const sessionPersonId = session.person?.id;
      if (!sessionPersonId || (personId && personId !== sessionPersonId)) {
        throw new Error("Care-record scope does not match the authenticated session");
      }
      const [conflictRows, evidenceRows] = await Promise.all([
        getJSON(`/uncertainty/contradictions/${encodeURIComponent(sessionPersonId)}`),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);
      if (!Array.isArray(conflictRows) || conflictRows.some((row) =>
        row?.person_id !== sessionPersonId || typeof row?.id !== "string")) {
        throw new Error("Invalid or cross-record conflict response");
      }
      if (!Array.isArray(evidenceRows) || evidenceRows.some((row) =>
        row?.person_id !== sessionPersonId || typeof row?.id !== "string")) {
        throw new Error("Invalid or cross-record evidence response");
      }
      setScopedPersonId(sessionPersonId);
      setConflicts(conflictRows as Conflict[]);
      setEvidence(evidenceRows as Evidence[]);
      setSelectedId((current) => current && conflictRows.some((row) => row.id === current)
        ? current : conflictRows[0]?.id ?? "");
    } catch {
      setScopedPersonId("");
      setConflicts([]);
      setEvidence([]);
      setSelectedId("");
      setError("We couldn’t load reports that differ or the notes and documents that support them. Try again.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const loadHistoryFor = useCallback(async (conflictId: string, personScope: string) => {
    if (!conflictId || !personScope) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryError("");
    try {
      const rows = await getJSON(`/uncertainty/contradictions/${encodeURIComponent(conflictId)}/history`);
      if (!Array.isArray(rows) || rows.some((row) =>
        row?.contradiction_id !== conflictId || row?.person_id !== personScope)) {
        throw new Error("Invalid or cross-record conflict history");
      }
      setHistory(rows as ResolutionEvent[]);
    } catch {
      setHistory([]);
      setHistoryError("We couldn’t load earlier reviews just now. This doesn’t mean none were saved.");
    }
  }, []);

  useEffect(() => { void loadHistoryFor(selectedId, scopedPersonId); }, [loadHistoryFor, scopedPersonId, selectedId]);

  async function submitResolution() {
    if (!selected || rationale.trim().length < 3) {
      setError("Choose the reports that differ and explain what you found.");
      return;
    }
    if (status === "partially_resolved" && (!scope.trim() || !unresolvedRemainder.trim() || evidenceIds.length === 0)) {
      setError("If you have only checked part of the information, say which part, what is still unclear, and add the notes or documents that support it.");
      return;
    }
    if (evidenceIds.some((id) => !evidence.some((row) => row.id === id && row.person_id === scopedPersonId))) {
      setError("Every selected note or document must belong to this Care Record.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await patchJSON(`/uncertainty/contradictions/${encodeURIComponent(selected.id)}`, {
        resolution_status: status,
        resolution_notes: rationale.trim(),
        resolution_scope: status === "partially_resolved" ? scope.trim() || null : null,
        unresolved_remainder: status === "partially_resolved" ? unresolvedRemainder.trim() || null : null,
        evidence_ids: evidenceIds,
      });
      setNotice("Your review was saved. Only the part you described is marked as reviewed. Related details have not changed.");
      setRationale("");
      await loadRecords();
      // Refresh the history for the exact conflict just changed. Do not rely on
      // React state from the preceding list refresh: that state update is async.
      await loadHistoryFor(selected.id, scopedPersonId);
    } catch {
      setError("We couldn’t confirm that this review was saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Review reports that do not match">
    <h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))", marginTop: 0 }}>When information differs</h3>
    <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
      A newer date or several similar reports do not automatically mean one version is right. Every review needs notes or documents to check, and a reason. If you can only check part of the information, say exactly which part.
    </p>
    {loading && <p role="status">Loading reports that differ…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Try again</button></p>}
    {!loading && !error && conflicts.length === 0 && <p>No reports that disagree are saved here right now. This does not mean no disagreement exists elsewhere.</p>}
    {!loading && !error && conflicts.length > 0 && <>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Reports that do not match
        <select style={field} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {conflicts.map((item) => <option key={item.id} value={item.id}>Care detail: {caregiverSafeGeneratedText(item.description) || "Saved reports differ"} · {caregiverStatusLabel(item.resolution_status) || "Status not available"}</option>)}
        </select>
      </label>
      {selected && <div style={{ border: "1px solid var(--border)", borderRadius: 7, padding: 10, marginBottom: 10, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
        <p><strong>Care detail:</strong> {caregiverSafeGeneratedText(selected.description) || "Saved reports differ"}</p>
        <p>{caregiverSafeGeneratedText(selected.description) || "Saved reports differ."}</p>
         
        <p><strong>Dates this applies to:</strong> {selected.effective_from || "Start unknown"} — {selected.effective_to || "End unknown"}</p>
        <p><strong>What have you checked:</strong> {caregiverSafeAssistantText(selected.resolution_scope) || "Nothing has been marked as resolved."}</p>
        <p><strong>What still needs checking:</strong> {caregiverSafeAssistantText(selected.unresolved_remainder) || "Not recorded"}</p>
        <p><strong>Related notes or documents:</strong> {selected.evidence_ids?.length ? selected.evidence_ids.length + " saved item(s)" : "None recorded"}</p>
        {selected.matching_candidate_ids?.length ? <p><strong>Other reports:</strong> {selected.matching_candidate_ids.length}</p> : null}
      </div>}
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>What did you find?
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{caregiverStatusLabel(value) || "Not available"}</option>)}
        </select>
      </label>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Why are you changing this?
        <textarea style={{ ...field, minHeight: 72 }} value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Which part have you checked? (if you have only checked part)
        <textarea style={{ ...field, minHeight: 60 }} value={scope} onChange={(event) => setScope(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>What still needs checking?
        <textarea style={{ ...field, minHeight: 60 }} value={unresolvedRemainder} onChange={(event) => setUnresolvedRemainder(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Notes or documents you checked
        <select multiple style={{ ...field, minHeight: 100 }} value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
          {evidence.map((item) => <option key={item.id} value={item.id}>Saved note or document · {caregiverSourceText(item.source_text.slice(0, 80)) || "Original wording is not available"}</option>)}
        </select>
      </label>
      <button type="button" style={button} onClick={() => void submitResolution()} disabled={saving || loading}>
        {saving ? "Saving resolution…" : "Save review"}
      </button>
      {notice && <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{notice}</p>}
      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Earlier reviews</strong>
        {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{historyError} <button type="button" style={button} onClick={() => void loadHistoryFor(selectedId, scopedPersonId)} disabled={saving}>Try again</button></p>}
        {history.length === 0 && !historyError && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>No earlier reviews have been saved yet.</p>}
        <ol style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", paddingLeft: 18 }}>
          {history.map((item) => <li key={item.id}>
            <strong>{caregiverStatusLabel(item.previous_status) || "Not recorded"} → {caregiverStatusLabel(item.new_status) || "Status not available"}</strong>
            <p>{caregiverSafeAssistantText(item.rationale) || "No further explanation is available."}</p>
            {item.resolution_scope && <p>Reviewed: {caregiverSafeAssistantText(item.resolution_scope) || "Not recorded"}</p>}
            {item.unresolved_remainder && <p>Still needs checking: {caregiverSafeAssistantText(item.unresolved_remainder) || "Not recorded"}</p>}
            <p>Related notes or documents: {item.evidence_ids?.length ? item.evidence_ids.length : "None recorded"} · {new Date(item.created_at).toLocaleString()}</p>
          </li>)}
        </ol>
      </div>
    </>}
  </section>;
}
