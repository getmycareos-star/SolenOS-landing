"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";

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
      setError("Conflicts and linked evidence could not be loaded from the authenticated care record. No empty result is assumed.");
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
      setError("Partial resolution requires the exact resolved scope, the unresolved remainder, and linked evidence for the resolved detail.");
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
        resolution_scope: scope.trim() || null,
        unresolved_remainder: unresolvedRemainder.trim() || null,
        evidence_ids: evidenceIds,
      });
      setNotice("Resolution transition saved with its rationale and evidence references. Only the stated scope is resolved; related details are not silently resolved.");
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
    <h3 style={{ fontSize: 15, marginTop: 0 }}>Conflict comparison and resolution history</h3>
    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      A newer timestamp or majority of reports does not automatically resolve a conflict. Every resolved or partially resolved state needs linked evidence and a rationale; partial resolution must name the exact detail resolved.
    </p>
    {loading && <p role="status">Loading persisted conflicts…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Retry load</button></p>}
    {!loading && !error && conflicts.length === 0 && <p>No conflict records were returned for this care record. This does not establish that no disagreement exists outside the available record.</p>}
    {!loading && !error && conflicts.length > 0 && <>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Conflict
        <select style={field} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {conflicts.map((item) => <option key={item.id} value={item.id}>{item.field}: {item.description.slice(0, 100)} · {item.resolution_status}</option>)}
        </select>
      </label>
      {selected && <div style={{ border: "1px solid var(--border)", borderRadius: 7, padding: 10, marginBottom: 10, fontSize: 12 }}>
        <p><strong>Disputed detail:</strong> {selected.subject_type} / {selected.subject_id} / {selected.field}</p>
        <p>{selected.description}</p>
        <p><strong>Context:</strong> {selected.context_key || "Not recorded"}</p>
        <p><strong>Effective interval:</strong> {selected.effective_from || "Start unknown"} — {selected.effective_to || "End unknown"}</p>
        <p><strong>Current partial-resolution scope:</strong> {selected.resolution_scope || "None recorded"}</p>
        <p><strong>Unresolved remainder:</strong> {selected.unresolved_remainder || "Not separately recorded"}</p>
        <p><strong>Linked evidence:</strong> {selected.evidence_ids?.length ? selected.evidence_ids.join(", ") : "None recorded"}</p>
        {selected.matching_candidate_ids?.length ? <p><strong>Related conflict candidates:</strong> {selected.matching_candidate_ids.join(", ")}</p> : null}
      </div>}
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Resolution transition
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Resolution rationale
        <textarea style={{ ...field, minHeight: 72 }} value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Exact scope resolved (required for partial resolution)
        <textarea style={{ ...field, minHeight: 60 }} value={scope} onChange={(event) => setScope(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>What remains unresolved (required for partial resolution)
        <textarea style={{ ...field, minHeight: 60 }} value={unresolvedRemainder} onChange={(event) => setUnresolvedRemainder(event.target.value)} />
      </label>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Evidence supporting the resolution (multi-select)
        <select multiple style={{ ...field, minHeight: 100 }} value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
          {evidence.map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id} · {item.source_text.slice(0, 80)}</option>)}
        </select>
      </label>
      <button type="button" style={button} onClick={() => void submitResolution()} disabled={saving || loading}>
        {saving ? "Saving resolution…" : "Save conflict transition"}
      </button>
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Append-only transition history</strong>
        {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError}</p>}
        {history.length === 0 && !historyError && <p style={{ fontSize: 12 }}>No resolution transitions have been recorded yet.</p>}
        <ol style={{ fontSize: 12, paddingLeft: 18 }}>
          {history.map((item) => <li key={item.id}>
            <strong>{item.previous_status.replaceAll("_", " ")} → {item.new_status.replaceAll("_", " ")}</strong>
            <p>{item.rationale}</p>
            {item.resolution_scope && <p>Resolved scope: {item.resolution_scope}</p>}
            {item.unresolved_remainder && <p>Still unresolved: {item.unresolved_remainder}</p>}
            <p>Evidence: {item.evidence_ids?.length ? item.evidence_ids.join(", ") : "None recorded"} · {item.created_at}</p>
          </li>)}
        </ol>
      </div>
    </>}
  </section>;
}
