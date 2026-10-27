"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { getJSON, postJSON } from "@/api/client";

type Row = Record<string, unknown>;
type Summary = { resources: Record<string, number> };
const resources = ["facts", "fact-evidence", "relationships", "decisions", "decision-outcomes", "integrity-findings", "integrity-resolutions", "reconciliations", "delta-items", "follow-up-links", "review-decisions", "provenance", "timeline", "change-assessments", "events", "evidence", "changes", "situations", "state-revisions", "temporal-facts", "temporal-relations", "temporal-relationships", "temporal-reference-frames", "temporal-contradictions", "uncertainty-assessments", "causal-hypotheses", "causal-evidence", "contradictions", "significance-assessments", "delta-runs", "open-questions", "information-gaps", "assertions", "living-records", "record-provenance", "record-provenance-links", "record-change-sets", "record-change-items", "corrections", "amendments", "amendment-items", "record-audit", "uncertainties", "missing-information", "conflicts", "action-outcomes", "caregiver-contexts", "caregiver-perspectives", "caregiver-observations", "record-versions", "record-snapshots"];
const labels: Record<string, string> = {
 facts: "Care facts", "fact-evidence": "Fact evidence links", relationships: "Record relationships",
 decisions: "Care decisions", "decision-outcomes": "Decision outcomes",
 "integrity-findings": "Integrity findings", "integrity-resolutions": "Integrity resolutions",
 reconciliations: "Reconciliation history", "delta-items": "Detected changes",
 "follow-up-links": "Follow-up links", "review-decisions": "Review decisions",
 provenance: "Source provenance", timeline: "Care timeline", "change-assessments": "Change assessments",
 events: "Care events", evidence: "Evidence", changes: "Changes", situations: "Situations",
 "state-revisions": "Care state revisions", "temporal-facts": "Temporal facts",
 "temporal-relations": "Temporal relations", "temporal-relationships": "Temporal relationships",
 "temporal-reference-frames": "Temporal reference frames", "temporal-contradictions": "Temporal contradictions",
 "uncertainty-assessments": "Uncertainty assessments", "causal-hypotheses": "Causal hypotheses",
 "causal-evidence": "Hypothesis evidence", contradictions: "Care contradictions",
 "significance-assessments": "Significance assessments", "delta-runs": "Delta Engine runs",
 "open-questions": "Open questions", "information-gaps": "Information gaps", assertions: "Care assertions",
 "living-records": "Living Care Record", "record-provenance": "Record provenance",
 "record-provenance-links": "Provenance links", "record-change-sets": "Record change sets",
 "record-change-items": "Record change items", corrections: "Corrections",
 amendments: "Record amendments", "amendment-items": "Amendment items",
 "record-audit": "Record audit history", uncertainties: "Open uncertainties",
 "missing-information": "Missing care information", conflicts: "Conflicting claims",
 "action-outcomes": "Action outcomes", "caregiver-contexts": "Caregiver context",
 "caregiver-perspectives": "Caregiver perspectives", "caregiver-observations": "Caregiver observations",
 "record-versions": "Immutable record versions", "record-snapshots": "Record snapshots"
};
function rowText(r: Row) {
 if (r.version_number !== undefined) {
  const digest = typeof r.record_digest === "string" ? r.record_digest.slice(0, 12) : "digest unavailable";
  return `Version ${String(r.version_number)} · ${String(r.reason ?? "record snapshot")} · SHA-256 ${digest}…`;
 }
 if (r.as_of !== undefined) {
  const digest = typeof r.record_digest === "string" ? r.record_digest.slice(0, 12) : "digest unavailable";
  return `Snapshot as of ${String(r.as_of)} · SHA-256 ${digest}…`;
 }
 const value = r.fact_value ?? r.decision_text ?? r.perspective_text ?? r.context_payload ?? r.correction_reason ?? r.question ?? r.description ?? r.decision_notes ?? r.after_state ?? r.reconciliation_status ?? r.reason ?? r.status ?? "Care record";
 if (typeof value === "string") return value;
 if (value && typeof value === "object") return JSON.stringify(value);
 return String(value);
}

export default function CareContinuityPage() {
 const router = useRouter();
 const [summary, setSummary] = useState<Summary | null>(null);
 const [rows, setRows] = useState<Record<string, Row[]>>({});
 const [fact, setFact] = useState("");
 const [decision, setDecision] = useState("");
 const [error, setError] = useState("");
 const [busy, setBusy] = useState(false);
 const [snapshotBusy, setSnapshotBusy] = useState(false);
 const [snapshotMessage, setSnapshotMessage] = useState("");
 const [unavailableResources, setUnavailableResources] = useState<string[]>([]);

 const load = useCallback(async () => {
  setError("");
  try {
   const s = await getJSON("/care-continuity/summary") as Summary;
   setSummary(s);
   const missing: string[] = [];
   const values = await Promise.all(resources.map(async key => {
    try {
     return [key, await getJSON(`/care-continuity/${key}?limit=25`) as Row[]] as const;
    } catch {
     missing.push(key);
     return [key, [] as Row[]] as const;
    }
   }));
   setRows(Object.fromEntries(values));
   setUnavailableResources(missing);
  } catch (e) { setError(e instanceof Error ? e.message : "Unable to load the saved care record."); }
 }, []);
 useEffect(() => { void load(); }, [load]);

 async function captureSnapshot() {
  setSnapshotBusy(true); setError(""); setSnapshotMessage("");
  try {
   let records = await getJSON("/care-continuity/living-records?limit=1") as Row[];
   let record = records[0];
   if (!record?.id) {
    record = await postJSON("/care-continuity/living-records", { record_status: "active", schema_version: "lcr.v1" }) as Row;
   }
   const saved = await postJSON("/care-continuity/record-versions", {
    care_record_id: String(record.id),
    reason: "Caregiver-requested Living Care Record snapshot",
   }) as Row;
   setSnapshotMessage(`Saved version ${String(saved.version_number)} · SHA-256 ${String(saved.record_digest).slice(0, 12)}…`);
   await load();
  } catch (err) {
   setError(err instanceof Error ? err.message : "The record snapshot could not be saved.");
  } finally {
   setSnapshotBusy(false);
  }
 }

 async function saveFact(e: FormEvent) {
  e.preventDefault(); if (!fact.trim()) return;
  setBusy(true); setError("");
  try {
   await postJSON("/care-continuity/facts", { subject_type: "care_record", fact_type: "caregiver_report", fact_value: fact.trim(), epistemic_status: "reported" });
   setFact(""); await load();
  } catch (err) { setError(err instanceof Error ? err.message : "Fact could not be saved."); }
  finally { setBusy(false); }
 }
 async function saveDecision(e: FormEvent) {
  e.preventDefault(); if (!decision.trim()) return;
  setBusy(true); setError("");
  try {
   await postJSON("/care-continuity/decisions", { title: "Care decision", decision_text: decision.trim(), decision_status: "recorded", evidence_ids: [] });
   setDecision(""); await load();
  } catch (err) { setError(err instanceof Error ? err.message : "Decision could not be saved."); }
  finally { setBusy(false); }
 }
 const panel = { border: "1px solid var(--border, #d7ddd7)", borderRadius: 14, padding: 16, marginBottom: 16 } as const;
 const field = { width: "100%", padding: 12, border: "1px solid var(--border, #cbd5cb)", borderRadius: 8 } as const;
 const submit = { padding: "10px 14px", borderRadius: 8, background: "#dce9dc", color: "#172117", fontWeight: 650 } as const;

 return <main className="mobile-screen" style={{ padding: "20px 16px 40px", maxWidth: 860, margin: "0 auto" }}>
  <button type="button" onClick={() => router.push("/workspace")} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}><ArrowLeft size={18}/> Back to Living Care Record</button>
  <header style={{ marginBottom: 20 }}>
   <p style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>SolenOS · Care continuity</p>
   <h1 style={{ fontSize: 28, fontWeight: 700 }}>Deep Living Care Record</h1>
   <p>Persisted facts, decisions, uncertainty and record integrity. A reported claim is not automatically a verified fact.</p>
  </header>
  <section style={panel}>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
    <h2 style={{ fontSize: 18, fontWeight: 650 }}>Railway record inventory</h2>
    <button type="button" onClick={() => void load()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><RefreshCw size={16}/> Refresh</button>
   </div>
   {summary ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, marginTop: 12 }}>
    {Object.entries(summary.resources).map(([key, count]) => <div key={key} style={{ padding: 10, borderRadius: 10, background: "var(--card, #f5f7f4)" }}><div style={{ fontSize: 12, overflowWrap: "anywhere" }}>{key.replaceAll("_", " ")}</div><strong style={{ fontSize: 24 }}>{count}</strong></div>)}
   </div> : <p>Loading saved records…</p>}
  </section>
  <section style={panel}>
   <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>Record history checkpoint</h2>
   <p style={{ marginBottom: 12 }}>Capture an immutable version of the persisted Living Care Record. The snapshot is generated from saved records, not text supplied to this button.</p>
   <button type="button" disabled={snapshotBusy} onClick={() => void captureSnapshot()} style={submit}>{snapshotBusy ? "Saving snapshot…" : "Capture record snapshot"}</button>
   {snapshotMessage && <p role="status" style={{ marginTop: 10, overflowWrap: "anywhere" }}>{snapshotMessage}</p>}
  </section>
  <section style={panel}>
   <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 10 }}>Add a care fact</h2>
   <form onSubmit={saveFact} style={{ display: "grid", gap: 10 }}>
    <label htmlFor="care-fact">Care information</label>
    <textarea id="care-fact" value={fact} onChange={e => setFact(e.target.value)} required rows={3} maxLength={5000} placeholder="Record what was reported. Do not enter a guess as a verified fact." style={field}/>
    <button type="submit" disabled={busy || !fact.trim()} style={submit}>Save as reported</button>
   </form>
   <p style={{ fontSize: 12, marginTop: 8 }}>Saved through the authenticated backend. This does not mark the report as verified.</p>
  </section>
  <section style={panel}>
   <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 10 }}>Record a care decision</h2>
   <form onSubmit={saveDecision} style={{ display: "grid", gap: 10 }}>
    <label htmlFor="care-decision">Decision and context</label>
    <textarea id="care-decision" value={decision} onChange={e => setDecision(e.target.value)} required rows={3} maxLength={5000} placeholder="What was decided, without assuming its outcome." style={field}/>
    <button type="submit" disabled={busy || !decision.trim()} style={submit}>Save decision</button>
   </form>
  </section>
  {unavailableResources.length > 0 && <p role="status" style={{ padding: 12, border: "1px solid var(--border, #d7ddd7)", borderRadius: 8, marginBottom: 16 }}>Some advanced history APIs are not available on the connected backend yet: {unavailableResources.map(key => labels[key] ?? key).join(", ")}. Other saved record sections remain available.</p>}
  {error && <p role="alert" style={{ padding: 12, border: "1px solid #b42318", borderRadius: 8, marginBottom: 16 }}>{error}</p>}
  {Object.entries(rows).map(([key, items]) => <section key={key} style={panel}>
   <h2 style={{ fontSize: 18, fontWeight: 650 }}>{labels[key]}</h2>
   {items.length ? <ul style={{ display: "grid", gap: 10, paddingLeft: 18, marginTop: 12 }}>{items.map((r, i) => <li key={String(r.id ?? i)}><p style={{ overflowWrap: "anywhere" }}>{rowText(r)}</p><small style={{ opacity: .75 }}>{String(r.epistemic_status ?? r.reconciliation_status ?? r.status ?? r.decision_status ?? "Recorded")} · {String(r.created_at ?? r.recorded_at ?? "")}</small></li>)}</ul> : <p style={{ marginTop: 8 }}>No saved records in this category yet.</p>}
  </section>)}
  <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: .8 }}><ShieldCheck size={16}/> Access is scoped by the active SolenOS session. Existing source records are reused, not duplicated.</p>
 </main>;
}
