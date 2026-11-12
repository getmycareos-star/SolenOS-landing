"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
      setError("Reports that differ and their supporting information could not be loaded. No empty result is assumed.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const loadHistory = useCallback(async () => {
    if (!selectedId || !scopedPersonId) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryError("");
    try {
      const rows = await getJSON(`/uncertainty/contradictions/${encodeURIComponent(selectedId)}/history`);
      if (!Array.isArray(rows) || rows.some((row) =>
        row?.contradiction_id !== selectedId || row?.person_id !== scopedPersonId)) {
        throw new Error("Invalid or cross-record conflict history");
      }
      setHistory(rows as ResolutionEvent[]);
    } catch {
      setHistory([]);
      setHistoryError("Resolution history is unavailable. A failed request is not an empty history.");
    }
  }, [scopedPersonId, selectedId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function submitResolution() {
    if (!selected || rationale.trim().length < 3) {
      setError("Select a conflict and provide a clear resolution rationale.");
      return;
    }
    if (status === "partially_resolved" && (!scope.trim() || !unresolvedRemainder.trim() || evidenceIds.length === 0)) {
      setError("A partial review needs the exact part being reviewed, what remains unclear, and supporting information for the detail.");
      return;
    }
    if (evidenceIds.some((id) => !evidence.some((row) => row.id === id && row.person_id === scopedPersonId))) {
      setError("Every selected evidence item must belong to the authenticated care record.");
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
      setNotice("Update the review status saved with its rationale and evidence references. Only the stated scope is resolved; related details are not silently resolved.");
      setRationale("");
      await loadRecords();
      await loadHistory();
    } catch {
      setError("Conflict resolution persistence was not confirmed. Check scope, evidence, permissions, and connection; no successful resolution is assumed.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Evidence-grounded conflict resolution">
    <h3 style={{ fontSize: 15, marginTop: 0 }}>When information differs</h3>
    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      A newer timestamp or majority of reports does not automatically resolve a conflict. Every completed or partial review needs supporting information and a reason; a partial review must name the exact detail reviewed.
    </p>
    {loading && <p role="status">Loading persisted conflicts…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Retry load</button></p>}
    {!loading && !error && conflicts.length === 0 && <p>No conflicting reports are currently recorded in this care record. This does not establish that no disagreement exists outside the information available to SolenOS.</p>}
    {!loading && !error && conflicts.length > 0 && <>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Conflict
        <select style={field} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {conflicts.map((item) => <option key={item.id} value={item.id}>Care detail: {caregiverSafeAssistantText(item.description) || "Saved reports differ"} · {caregiverStatusLabel(item.resolution_status) || "Status not available"}</option>)}
        </select>
      </label>
      {selected && <div style={{ border: "1px solid var(--border)", borderRadius: 7, padding: 10, marginBottom: 10, fontSize: 12 }}>
        <p><strong>Care detail:</strong> {caregiverSafeAssistantText(selected.description) || "Saved reports differ"}</p>
        <p>{caregiverSafeAssistantText(selected.description) || "Saved reports differ."}</p>
         
        <p><strong>Effective interval:</strong> {selected.effective_from || "Start unknown"} — {selected.effective_to || "End unknown"}</p>
        <p><strong>What has been reviewed:</strong> {caregiverSafeAssistantText(selected.resolution_scope) || "Nothing has been marked as resolved."}</p>
        <p><strong>What still needs checking:</strong> {caregiverSafeAssistantText(selected.unresolved_remainder) || "Not recorded"}</p>
        <p><strong>Supporting information:</strong> {selected.evidence_ids?.length ? selected.evidence_ids.length + " saved item(s)" : "None recorded"}</p>
        {selected.matching_candidate_ids?.length ? <p><strong>Related reports:</strong> {selected.matching_candidate_ids.length}</p> : null}
      </div>}
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Resolution transition
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{caregiverStatusLabel(value) || "Not available"}</option>)}
        </select>
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Why is this status changing?
        <textarea style={{ ...field, minHeight: 72 }} value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>What part has been resolved? (required for a partial review)
        <textarea style={{ ...field, minHeight: 60 }} value={scope} onChange={(event) => setScope(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>What still needs checking? (required for a partial review)
        <textarea style={{ ...field, minHeight: 60 }} value={unresolvedRemainder} onChange={(event) => setUnresolvedRemainder(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Supporting information
        <select multiple style={{ ...field, minHeight: 100 }} value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
          {evidence.map((item) => <option key={item.id} value={item.id}>Saved source · {caregiverSafeAssistantText(item.source_text.slice(0, 80)) || "Source text not available"}</option>)}
        </select>
      </label>
      <button type="button" style={button} onClick={() => void submitResolution()} disabled={saving || loading}>
        {saving ? "Saving resolution…" : "Save review"}
      </button>
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Previous review decisions</strong>
        {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError}</p>}
        {history.length === 0 && !historyError && <p style={{ fontSize: 12 }}>No resolution transitions have been recorded yet.</p>}
        <ol style={{ fontSize: 12, paddingLeft: 18 }}>
          {history.map((item) => <li key={item.id}>
            <strong>{caregiverStatusLabel(item.previous_status) || "Not recorded"} → {caregiverStatusLabel(item.new_status) || "Status not available"}</strong>
            <p>{caregiverSafeAssistantText(item.rationale) || "No further explanation is available."}</p>
            {item.resolution_scope && <p>Reviewed: {caregiverSafeAssistantText(item.resolution_scope) || "Not recorded"}</p>}
            {item.unresolved_remainder && <p>Still needs checking: {caregiverSafeAssistantText(item.unresolved_remainder) || "Not recorded"}</p>}
            <p>Supporting information: {item.evidence_ids?.length ? item.evidence_ids.length + " saved item(s)" : "None recorded"} · {new Date(item.created_at).toLocaleString()}</p>
          </li>)}
        </ol>
      </div>
    </>}
  </section>;
}
