"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Plus, Clock3, AlertCircle, CheckCircle2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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

function latestResponseUpdate(loop: OpenLoop): { text: string; callbackPromised: boolean } | null {
  const latest = [...(loop.response_evidence ?? [])].reverse().find(
    (item) => typeof item.text === "string" && item.text.trim().length > 0,
  );
  if (!latest || typeof latest.text !== "string") return null;
  return {
    text: caregiverSafeAssistantText(latest.text) || "A response was recorded.",
    callbackPromised: latest.response_outcome === "callback_promised",
  };
}

function readableLoopType(value: string): string {
  return LOOP_TYPES.find(([key]) => key === value)?.[1] ?? "Care follow-up";
}

function readablePriority(value: string): string {
  return ({ critical: "Urgent", high: "High", normal: "Normal", low: "Low" } as Record<string, string>)[value] ?? "Not recorded";
}

function readableLoopStatus(value: string): string {
  return caregiverStatusLabel(value) ?? "Status not available";
}

export default function OpenLoopsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [attentionAssessment, setAttentionAssessment] = useState<any>(null);
  const [attentionWarning, setAttentionWarning] = useState("");
  const [historyById, setHistoryById] = useState<Record<string, LoopHistoryEvent[]>>({});
  const [loopType, setLoopType] = useState<string>("unresolved_concern");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineSource, setDeadlineSource] = useState("explicit_user");
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingActionKeys = useRef<Record<string, { signature: string; key: string }>>({});
  const pendingCreateKey = useRef<{ signature: string; key: string } | null>(null);

  const refresh = useCallback(async () => {
    await ensureAnonymousSession();
    const query = new URLSearchParams({ limit: "100" });
    if (filter !== "all") query.set("status", filter);
    const openLoopsRequest = filter === "open" ? getJSON("/open-loops?limit=100") : getJSON(`/open-loops?${query.toString()}`);
    const [result, attentionResult] = await Promise.allSettled([openLoopsRequest, getJSON("/care-continuity/situation-understanding")]);
    if (attentionResult.status === "fulfilled") {
      const response = attentionResult.value as any;
      let assessment = response?.assessment ?? null;
      if (!assessment || response?.source_freshness?.reassessment_recommended === true) {
        try { const refreshed = await postJSON("/care-continuity/situation-understanding/reassess", {}) as any; assessment = refreshed?.assessment ?? assessment; }
        catch { setAttentionWarning("SolenOS could not refresh its latest attention review. Saved follow-ups remain visible."); }
      }
      setAttentionAssessment(assessment);
      if (!assessment) setAttentionWarning("SolenOS could not load its attention review. Saved follow-ups remain visible."); else setAttentionWarning("");
    } else setAttentionWarning("SolenOS could not load its attention review. Saved follow-ups remain visible.");
    if (result.status !== "fulfilled") throw result.reason;
    const persistedResult = result.value;
    if (!persistedResult || !Array.isArray((persistedResult as { items?: unknown }).items)) {
      throw new Error("The Open Loops API returned an unexpected response.");
    }
    setLoops((persistedResult as { items: OpenLoop[] }).items);
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
    const refreshOnCareChange = () => { void refresh().catch(() => setAttentionWarning("SolenOS could not refresh its latest attention review. Saved follow-ups remain visible.")); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshOnCareChange(); };
    window.addEventListener("careRecordUpdated", refreshOnCareChange);
    window.addEventListener("focus", refreshOnCareChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("careRecordUpdated", refreshOnCareChange);
      window.removeEventListener("focus", refreshOnCareChange);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
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
      const createPayload = {
        loop_type: loopType,
        title: title.trim(),
        description: description.trim(),
        source_type: null,
        source_id: null,
        evidence: [],
        uncertainty: "unknown",
        ...(deadline ? { deadline_at: new Date(deadline).toISOString(), deadline_source: deadlineSource, deadline_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}),
      };
      const signature = JSON.stringify(createPayload);
      const pending = pendingCreateKey.current;
      const idempotencyKey = pending?.signature === signature ? pending.key : "open-loop-" + crypto.randomUUID();
      pendingCreateKey.current = { signature, key: idempotencyKey };
      const saved = await postJSON("/open-loops", {
        ...createPayload,
        idempotency_key: idempotencyKey,
      });
      await refresh();
      pendingCreateKey.current = null;
      setTitle("");
      setDescription("");
      setDeadline("");
      setNotice((saved as { recurrence_detected?: boolean }).recurrence_detected
        ? "This looks like a repeat of an existing issue. It was added to that issue’s history."
        : "Follow-up saved to your care record.");
    } catch (reason) {
      setError("The follow-up was not saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(loop: OpenLoop, action: "reassess" | "response" | "action" | "outcome" | "verify" | "reconcile" | "close" | "cancel" | "dependency" | "defer" | "review" | "reopen" | "history") {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    let pendingActionKeyToClear: string | null = null;
    try {
      if (action === "reassess") {
        await postJSON("/open-loops/reassess", {});
      } else if (action === "history") {
        const result = await getJSON(`/open-loops/${encodeURIComponent(loop.id)}/history?limit=100`);
        if (!Array.isArray(result)) throw new Error("The audit history response was invalid.");
        setHistoryById((current) => ({ ...current, [loop.id]: result as LoopHistoryEvent[] }));
      } else if (action === "dependency") {
        const prerequisites = loops.filter((item) => item.id !== loop.id && !["closed", "cancelled"].includes(item.status));
        if (!prerequisites.length) throw new Error("No other open follow-ups are available.");
        const choices = prerequisites.slice(0, 20).map((item, index) => `${index + 1}. ${caregiverSafeAssistantText(item.title) || "Care follow-up"} · ${readableLoopStatus(item.status)}`).join("\\n");
        const choice = window.prompt("Which follow-up must happen first? Enter its number.\\n\\n" + choices);
        const selected = Number(choice) - 1;
        const prerequisite = Number.isInteger(selected) && selected >= 0 ? prerequisites.slice(0, 20)[selected] : null;
        if (!prerequisite) return;
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/dependencies`, {
          prerequisite_id: prerequisite.id,
          mandatory: true,
        });
      } else if (action === "defer" || action === "review") {
        const reason = window.prompt(action === "defer"
          ? "Why are you waiting before making this decision?"
          : "Why does this item still need attention? It will not be marked resolved.");
        if (!reason?.trim()) return;
        await patchJSON(`/open-loops/${encodeURIComponent(loop.id)}`, {
          status: action === "defer" ? "deferred" : "review_abandoned",
          reason: reason.trim(),
          ...(action === "defer" ? { deferred_reason: reason.trim() } : {}),
        });
      } else {
        const text = action === "response" ? window.prompt("What response did you receive? Use the exact words if possible.") :
          action === "action" ? window.prompt("What action was actually taken? Do not say it is complete unless you know.") :
          action === "outcome" ? window.prompt("What happened next?") :
          action === "verify" ? window.prompt("What do the two saved reports say together? Do not add anything they do not support.") :
          action === "reconcile" ? window.prompt("How do you understand the different reports? If they still disagree, say so.") :
          action === "close" ? window.prompt("What has happened that means this follow-up can be closed? Do not guess.") :
          action === "reopen" ? window.prompt("Why does this item need attention again?") :
          window.prompt("Why are you stopping this follow-up? This does not mean the issue was resolved.");
        if (!text?.trim()) return;
        const responseOutcome = action === "response"
          ? (window.confirm("Did they say someone would call back, with the appointment still unconfirmed?")
              ? "callback_promised"
              : "response_received")
          : null;
        const verificationRule = action === "verify"
          ? window.prompt("What would need to be true for you to consider this outcome checked?")
          : null;
        if (action === "verify" && !verificationRule?.trim()) return;
        let evidence: Array<Record<string, unknown>> = [
          { kind: "caregiver_recorded", text: text.trim(), recorded_at: new Date().toISOString() },
        ];
        let selectedSourceId: string | null = null;
        let selectedRelatedSourceId: string | null = null;
        if ((action === "response" && loop.loop_type === "professional_input") || action === "verify" || action === "reconcile") {
          const activeSession = await ensureAnonymousSession();
          const sourceRows = await getJSON(`/evidence/${encodeURIComponent(activeSession.person.id)}`);
          if (!Array.isArray(sourceRows)) {
            throw new Error("The saved care information could not be loaded. Please try again.");
          }
          const sources = (sourceRows as Array<Record<string, unknown>>).filter(
            (item) => typeof item.id === "string" && typeof item.type === "string",
          );
          if (sources.length === 0) {
            const requiredAction = action === "verify"
              ? "verify an outcome"
              : action === "reconcile"
                ? "reconcile conflicting accounts"
                : "record professional input";
            throw new Error("No saved information is available for this review yet. Add the relevant note or document before you " + requiredAction + ".");
          }
          const choices = sources.slice(0, 20).map((item, index) =>
            `${index + 1}. ${caregiverStatusLabel(String(item.type)) || "Saved care item"} — ${caregiverSafeAssistantText(String(item.source_text ?? ""))?.slice(0, 110) || "Source details not available"}`,
          ).join("\\n");
          const sourceRequirement = action === "verify"
            ? "Choose two separate saved items from different people or documents. This review does not prove that the reports are true or that one caused the other."
            : action === "reconcile"
              ? "Choose saved information that helps explain the different reports. If they still disagree, leave them unresolved."
              : "Choose the saved information that records the healthcare professional’s response.";
          const sourceChoice = window.prompt(
            "Choose the first saved item by entering its number. " + sourceRequirement + "\\n\\n" + choices,
          );
          if (!sourceChoice?.trim()) return;
          const sourceIndex = Number(sourceChoice) - 1;
          const selected = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sources.slice(0, 20)[sourceIndex] : null;
          if (!selected) {
            throw new Error("Choose a number from the list. Nothing was saved.");
          }
          selectedSourceId = String(selected.id);
          if (action === "verify") {
            // A persisted pair-level caregiver assessment is required before the backend can record corroboration.
            // This records source independence review, not semantic entailment or proof of causation.
            const secondChoices = sources.filter((item) => item.id !== selectedSourceId).slice(0, 20);
            const secondList = secondChoices.map((item, index) => `${index + 1}. ${caregiverStatusLabel(String(item.type)) || "Saved care item"} — ${caregiverSafeAssistantText(String(item.source_text ?? ""))?.slice(0, 110) || "Source details not available"}`).join("\\n");
            const secondChoice = window.prompt("Choose a different saved item from another person or document. Enter its number.\\n\\n" + secondList);
            if (!secondChoice?.trim()) return;
            const secondIndex = Number(secondChoice) - 1;
            const second = Number.isInteger(secondIndex) && secondIndex >= 0 ? secondChoices[secondIndex] : null;
            if (!second) {
              throw new Error("Choose a different saved item from the list.");
            }
            selectedRelatedSourceId = String(second.id);
            const relationshipPath = `/care-continuity/evidence/${encodeURIComponent(selectedSourceId)}/relationships`;
            const relationshipBody = {
              related_evidence_id: String(second.id),
              relationship_type: "corroborates",
              source_independence_status: "independent",
              scope_type: "evidence_pair",
              rationale: "Caregiver reviewed this pair and explicitly assessed the source origins as independent.",
            };
            try {
              await postJSON(relationshipPath, relationshipBody);
            } catch (relationshipError) {
              const existing = await getJSON(relationshipPath);
              const matches = Array.isArray(existing) && existing.some((row: Record<string, unknown>) =>
                row.relationship_type === "corroborates" &&
                row.source_independence_status === "independent" &&
                ((row.source_evidence_id === selectedSourceId && row.related_evidence_id === String(second.id)) ||
                 (row.source_evidence_id === String(second.id) && row.related_evidence_id === selectedSourceId)),
              );
              if (!matches) throw relationshipError;
            }
            evidence = [
              { kind: "care_record_source", evidence_id: selectedSourceId, text: "First saved item chosen by caregiver for a second-source review." },
              { kind: "care_record_source", evidence_id: String(second.id), text: "Second saved item chosen by caregiver for a second-source review." },
            ];
          } else {
            evidence = [{
              kind: action === "reconcile" ? "contradiction_reconciliation_source" : "care_record_source",
              evidence_id: selectedSourceId,
              text: action === "reconcile"
                ? "Saved item chosen by caregiver to review different reports."
                : "Saved item chosen by caregiver to review a professional response.",
            }];
          }
        }
        const signature = JSON.stringify({
          action,
          text: text.trim(),
          verification_rule: verificationRule?.trim() || null,
          source_evidence_id: selectedSourceId,
          related_source_evidence_id: selectedRelatedSourceId,
        });
        const pendingKey = loop.id + ":" + action;
        const pending = pendingActionKeys.current[pendingKey];
        const idempotencyKey = pending?.signature === signature ? pending.key : crypto.randomUUID();
        pendingActionKeys.current[pendingKey] = { signature, key: idempotencyKey };
        const payload = {
          text: text.trim(),
          evidence,
          ...(verificationRule?.trim() ? { verification_rule: verificationRule.trim() } : {}),
          ...(responseOutcome ? { response_outcome: responseOutcome } : {}),
          idempotency_key: idempotencyKey,
        };
        const endpoint = action === "response" ? "responses" : action === "action" ? "actions" : action === "outcome" ? "outcomes" : action === "verify" ? "corroborate-outcome" : action === "reconcile" ? "reconcile" : action === "close" ? "close" : action === "reopen" ? "reopen" : "cancel";
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/${endpoint}`, payload);
        pendingActionKeyToClear = pendingKey;
      }
      await refresh();
      // Keep the key if the mutation committed but refresh failed. A retry must
      // replay the same backend event instead of appending duplicate evidence.
      if (pendingActionKeyToClear) delete pendingActionKeys.current[pendingActionKeyToClear];
      setNotice(action === "reassess" ? "SolenOS reviewed the follow-ups." : "Your update was saved. Check the status below.");
    } catch (reason) {
      setError("We could not confirm that change. Please try again.");
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
        <p style={{ fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, opacity: 0.7 }}>SOLENOS CARE CONTINUITY</p>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.15, margin: "8px 0" }}>Follow-ups</h1>
        <p style={{ maxWidth: 660, lineHeight: 1.6 }}>SolenOS reviews the saved care history and keeps unresolved matters visible. You only need to step in when your knowledge or action is needed.</p>
      </header>

      <details style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 14, padding: 14, marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Tell SolenOS about something it may have missed</summary>
        <p style={{ margin: "10px 0", fontSize: 13, lineHeight: 1.5 }}>You do not need to create or manage follow-ups. Use this only when an important matter is missing from the saved care history. SolenOS treats this as your report, not a verified fact.</p>
      <form onSubmit={createLoop} style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 16, padding: 18, marginBottom: 24, display: "grid", gap: 14 }}>
        <h2 style={{ fontSize: 20, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Plus size={19} aria-hidden /> Share missing information</h2>
        <label htmlFor="open-loop-type" style={{ display: "grid", gap: 6 }}>Type</label>
        <select id="open-loop-type" aria-label="Type" value={loopType} onChange={(event) => setLoopType(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }}>
          {LOOP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label style={{ display: "grid", gap: 6 }}>Short title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={240} placeholder="What still needs attention?" style={{ minHeight: 44, padding: 10, borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Context and what is known
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={12000} rows={4} placeholder="Separate what was observed, what was reported, and what remains uncertain." style={{ padding: 10, borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Deadline (optional; leave blank if none is established)
          <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }} />
        </label>
        {deadline && <label style={{ display: "grid", gap: 6 }}>Why this deadline exists
          <select value={deadlineSource} onChange={(event) => setDeadlineSource(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 8 }}>
            <option value="explicit_user">Explicitly entered by caregiver</option>
            <option value="recorded_commitment">Recorded commitment</option>
            <option value="system_policy">A written rule or care plan</option>
          </select>
        </label>}
        <Button type="submit" variant="primary" disabled={saving || !title.trim() || !description.trim()}>{saving ? "Saving…" : "Share with SolenOS"}</Button>
      </form>
      </details>

      {attentionWarning && <p role="status" style={{ border: "1px solid var(--border, #d6d9d3)", padding: 12, borderRadius: 10 }}>{attentionWarning}</p>}
      {attentionAssessment?.care_attention && <section aria-label="SolenOS attention review" style={{ display: "grid", gap: 14, marginBottom: 28 }}>
        <div><h2 style={{ fontSize: 22, margin: "0 0 5px" }}>SolenOS attention review</h2><p style={{ margin: 0, lineHeight: 1.5 }}>Based on saved care information currently available. Missing information is not treated as resolved.</p></div>
        {([["Needs attention", attentionAssessment.care_attention.needs_attention_now || []],["Important to address", attentionAssessment.care_attention.important_to_address || []],["Being monitored", attentionAssessment.care_attention.can_wait_with_documented_basis || []],["Needs clarification", attentionAssessment.care_attention.needs_clarification || []]] as Array<[string, any[]]>).map(([heading,items]) => <section key={heading} style={{ display:"grid",gap:9 }}>
          <h3 style={{fontSize:17,margin:0}}>{heading} ({items.length})</h3>
          {items.length===0 ? <p style={{margin:0,fontSize:13}}>No items returned in this category by the latest review.</p> : items.map((item:any,index:number)=><article key={String(item.source||"care")+":"+String(item.record_id||item.id||index)} style={{border:"1px solid var(--border, #d6d9d3)",borderRadius:12,padding:14}}>
            <strong>{caregiverSafeAssistantText(String(item.title||"Care matter"))||"Care matter"}</strong>
            {item.reason && <p style={{margin:"6px 0",lineHeight:1.5}}>{caregiverSafeAssistantText(String(item.reason))}</p>}
            {Array.isArray(item.priority_basis)&&item.priority_basis.length>0&&<p style={{margin:"6px 0",fontSize:13}}>{item.priority_basis.map((reason:string)=>caregiverSafeAssistantText(reason)).filter(Boolean).join(" · ")}</p>}
            <p style={{margin:"6px 0 0",fontSize:12,opacity:.75}}>Source: {caregiverSafeAssistantText(String(item.source||"Care history"))||"Care history"} · {Array.isArray(item.evidence_ids)?item.evidence_ids.length:0} evidence reference(s)</p>
          </article>)}
        </section>)}
        {Array.isArray(attentionAssessment.care_attention.limitations)&&attentionAssessment.care_attention.limitations.length>0&&<p role="note" style={{fontSize:12,lineHeight:1.5}}>Review limitations: {attentionAssessment.care_attention.limitations.map((item:string)=>caregiverSafeAssistantText(item)).filter(Boolean).join(" · ")}</p>}
      </section>}
      <section aria-labelledby="open-loop-list-heading">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 id="open-loop-list-heading" style={{ fontSize: 22, margin: 0 }}>Saved follow-up history</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select aria-label="Filter follow-ups" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ minHeight: 40, padding: 8, borderRadius: 8 }}>
              <option value="open">Open</option><option value="waiting">Waiting for a response</option><option value="deferred">Waiting before deciding</option><option value="blocked">Blocked by another step</option><option value="review_abandoned">Needs another look</option><option value="closed">Closed after review</option><option value="cancelled">Stopped</option><option value="all">All follow-ups</option>
            </select>
            <Button variant="secondary" onClick={() => { setLoading(true); void refresh().catch(() => setError("Could not refresh follow-ups. Please try again.")).finally(() => setLoading(false)); }} disabled={loading}>
              <RefreshCw size={16} aria-hidden /> Refresh
            </Button>
          </div>
        </div>

        {error && <p role="alert" style={{ border: "1px solid #b91c1c", padding: 12, borderRadius: 10 }}>{error}</p>}
        {notice && <p role="status" style={{ border: "1px solid #a3b18a", padding: 12, borderRadius: 10 }}>{notice}</p>}
        {loading ? <p aria-live="polite">Loading saved follow-ups…</p> :
          visibleLoops.length === 0 ? <div style={{ border: "1px dashed var(--border, #d6d9d3)", borderRadius: 14, padding: 24 }}>
            <CheckCircle2 size={22} aria-hidden /><h3>No follow-ups in this view</h3><p>No sample records are shown. If you expected something here, refresh and check that the correct care record is open.</p>
          </div> : <div style={{ display: "grid", gap: 14 }}>
            {visibleLoops.map((loop) => <article key={loop.id} style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.75 }}>{readableLoopType(loop.loop_type)} · {readableLoopStatus(loop.status)}</p>
                  <h3 style={{ margin: "0 0 8px", fontSize: 19 }}>{caregiverSafeAssistantText(loop.title) || "Care follow-up"}</h3>
                </div>
                <strong>{readablePriority(loop.priority)}</strong>
              </div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{caregiverSafeAssistantText(loop.description) || "No further details are available."}</p>
              {(() => {
                const latest = latestResponseUpdate(loop);
                if (!latest) return null;
                return (
                  <section role="note" aria-label="Latest reported response" style={{ margin: "10px 0", padding: 12, borderRadius: 10, background: "var(--surface-muted, #f6f7f4)" }}>
                    <strong style={{ fontSize: 13 }}>Latest update</strong>
                    <p style={{ margin: "5px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>{latest.text}</p>
                    {latest.callbackPromised && <p style={{ margin: "6px 0 0", fontSize: 13 }}>You recorded that a callback was promised. The appointment is not confirmed.</p>}
                  </section>
                );
              })()}
              <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                <Clock3 size={15} aria-hidden /> {dateLabel(loop.deadline_at)}
                {loop.overdue && <strong style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><AlertCircle size={15} aria-hidden /> Overdue</strong>}
              </p>
              {loop.priority_reasons.length > 0 && <p style={{ fontSize: 13 }}>Why it needs attention: {loop.priority_reasons.map(caregiverSafeAssistantText).filter(Boolean).join("; ")}</p>}
              {loop.blocking_prerequisites.length > 0 && <p style={{ fontSize: 13 }}>Waiting for: {loop.blocking_prerequisites.map((item) => caregiverSafeAssistantText(item.title) || "Another care item").join(", ")}</p>}
              {loop.missing_information.length > 0 && <p style={{ fontSize: 13 }}>Still needed: {loop.missing_information.map(caregiverSafeAssistantText).filter(Boolean).join(", ")}</p>}
              <p style={{ fontSize: 12, opacity: 0.75 }}>Outcome: {readableLoopStatus(loop.outcome_status)} · Updated {dateLabel(loop.updated_at)}</p>
              {loop.outcome_status === "outcome_verified" && (
                <p role="note" style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
                  A caregiver compared two separate saved items. This does not prove that the reports are true or that one caused the other.
                </p>
              )}
              {historyById[loop.id] && <section aria-label={`Previous updates for ${caregiverSafeAssistantText(loop.title) || "care follow-up"}`} style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-muted, #f6f7f4)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Previous updates</h4>
                {historyById[loop.id].length === 0 ? <p style={{ margin: 0, fontSize: 13 }}>No previous updates are available.</p> :
                  <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                    {historyById[loop.id].map((event) => <li key={event.id} style={{ fontSize: 13 }}>
                      <strong>{caregiverStatusLabel(event.event_type) || "Care update"}</strong> · {dateLabel(event.created_at)}
                      {event.evidence.length > 0 && <p style={{ margin: "4px 0 0" }}>Supporting information: {event.evidence.length} saved item(s)</p>}
                    </li>)}
                  </ol>}
              </section>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reassess")}>Review follow-ups with SolenOS</Button>
                <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "history")}>View previous updates</Button>
                {(loop.loop_type === "awaiting_response" || loop.loop_type === "professional_input" || loop.loop_type === "follow_up") && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "response")}>Record response</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "action")}>Record action</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "outcome")}>Record outcome</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "verify")}>Check outcome</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "dependency")}>Add what needs to happen first</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "defer")}>Wait before deciding</Button>}
                {["open", "waiting"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "review")}>Needs another look</Button>}
                {loop.loop_type === "contradiction" && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reconcile")}>Review different reports</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "close")}>Ask to close</Button>}
                {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "cancel")}>Stop following up</Button>}
                {["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reopen")}>Reopen</Button>}
              </div>
            </article>)}
          </div>}
      </section>
    </main>
  );
}
