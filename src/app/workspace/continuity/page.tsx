"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { getJSON, postJSON } from "@/api/client";

type Row = Record<string, unknown>;
type Summary = { resources: Record<string, number> };
const resources = ["facts", "decisions", "integrity-findings", "reconciliations", "delta-items", "follow-up-links", "review-decisions", "provenance", "timeline", "change-assessments"];
const labels: Record<string, string> = {
 facts: "Care facts", decisions: "Care decisions", "integrity-findings": "Integrity findings",
 reconciliations: "Reconciliation history", "delta-items": "Detected changes", "follow-up-links": "Follow-up links", "review-decisions": "Review decisions", provenance: "Source provenance", timeline: "Care timeline", "change-assessments": "Change assessments"
};
function rowText(r: Row) {
 return String(r.fact_value ?? r.decision_text ?? r.description ?? r.decision_notes ?? r.after_state ?? r.reconciliation_status ?? r.status ?? "Care record");
}

export default function CareContinuityPage() {
 const router = useRouter();
 const [summary, setSummary] = useState<Summary | null>(null);
 const [rows, setRows] = useState<Record<string, Row[]>>({});
 const [fact, setFact] = useState("");
 const [decision, setDecision] = useState("");
 const [error, setError] = useState("");
 const [busy, setBusy] = useState(false);

 const load = useCallback(async () => {
  setError("");
  try {
   const s = await getJSON("/care-continuity/summary") as Summary;
   setSummary(s);
   const values = await Promise.all(resources.map(async key => [key, await getJSON(`/care-continuity/${key}?limit=25`) as Row[]] as const));
   setRows(Object.fromEntries(values));
  } catch (e) { setError(e instanceof Error ? e.message : "Unable to load the saved care record."); }
 }, []);
 useEffect(() => { void load(); }, [load]);

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
  {error && <p role="alert" style={{ padding: 12, border: "1px solid #b42318", borderRadius: 8, marginBottom: 16 }}>{error}</p>}
  {Object.entries(rows).map(([key, items]) => <section key={key} style={panel}>
   <h2 style={{ fontSize: 18, fontWeight: 650 }}>{labels[key]}</h2>
   {items.length ? <ul style={{ display: "grid", gap: 10, paddingLeft: 18, marginTop: 12 }}>{items.map((r, i) => <li key={String(r.id ?? i)}><p style={{ overflowWrap: "anywhere" }}>{rowText(r)}</p><small style={{ opacity: .75 }}>{String(r.epistemic_status ?? r.reconciliation_status ?? r.status ?? r.decision_status ?? "Recorded")} · {String(r.created_at ?? r.recorded_at ?? "")}</small></li>)}</ul> : <p style={{ marginTop: 8 }}>No saved records in this category yet.</p>}
  </section>)}
  <p style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: .8 }}><ShieldCheck size={16}/> Access is scoped by the active SolenOS session. Existing source records are reused, not duplicated.</p>
 </main>;
}
