"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Clock3, AlertCircle, CheckCircle2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";

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

function dateLabel(value: string | null): string {
  if (!value) return "No deadline recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Deadline unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

export default function OpenLoopsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [historyById, setHistoryById] = useState<Record<string, LoopHistoryEvent[]>>({});
  const [description, setDescription] = useState("");
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
    const result = await getJSON(`/open-loops?${query.toString()}`);
    if (!result || !Array.isArray((result as { items?: unknown }).items)) {
      throw new Error("The Open Loops API returned an unexpected response.");
    }
    setLoops((result as { items: OpenLoop[] }).items);
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
    return () => { active = false; };
  }, [refresh]);

  const visibleLoops = useMemo(() => [...loops].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const rank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
  }), [loops]);

  async function createLoop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawText = description.trim();
    if (!rawText) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // Keep the caregiver's original words intact. The first sentence is only
      // a navigation label, not an AI-generated interpretation or care fact.
      const title = rawText.split(/\r?\n|(?<=[.!?])\s+/)[0].trim().slice(0, 240) || "Care update";
      const createPayload = {
        loop_type: "unresolved_concern",
        title,
        description: rawText,
        evidence: [{ kind: "caregiver_recorded", text: rawText }],
        uncertainty: "unknown",
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
      setDescription("");
      setNotice((saved as { recurrence_detected?: boolean }).recurrence_detected
        ? "This update was linked to an existing unresolved item. The new occurrence remains recorded."
        : "Saved. Your original words are preserved as an unresolved item. No deadline or outcome was assumed.");
    } catch (reason) {
      setError("The note was not saved. " + safeMessage(reason));
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
        const prerequisiteId = window.prompt("Enter the ID of the prerequisite open loop. The backend will verify that it belongs to this same care record and reject dependency cycles.");
        if (!prerequisiteId?.trim()) return;
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/dependencies`, {
          prerequisite_id: prerequisiteId.trim(),
          mandatory: true,
        });
      } else if (action === "defer" || action === "review") {
        const reason = window.prompt(action === "defer"
          ? "Why is this decision being deferred? Record the actual reason."
          : "Why does this inactive item need human review? It will not be marked resolved.");
        if (!reason?.trim()) return;
        await patchJSON(`/open-loops/${encodeURIComponent(loop.id)}`, {
          status: action === "defer" ? "deferred" : "review_abandoned",
          reason: reason.trim(),
          ...(action === "defer" ? { deferred_reason: reason.trim() } : {}),
        });
      } else {
        const text = action === "response" ? window.prompt("Record the actual response received. Do not invent a response.") :
          action === "action" ? window.prompt("Record the action actually taken. Do not imply an outcome unless it was observed.") :
          action === "outcome" ? window.prompt("Record the outcome that was reported.") :
          action === "verify" ? window.prompt("Describe what the two independent source records jointly support. Do not claim causation or certainty beyond the evidence.") :
          action === "reconcile" ? window.prompt("Record the explicit reconciliation decision. Preserve disagreement if it remains unresolved.") :
          action === "close" ? window.prompt("Describe the evidence supporting closure. This will not bypass backend verification.") :
          action === "reopen" ? window.prompt("Why is this closed or cancelled loop being reopened?") :
          window.prompt("Why are you cancelling further pursuit? Cancellation is not resolution.");
        if (!text?.trim()) return;
        const verificationRule = action === "verify"
          ? window.prompt("What explicit criterion was used to verify the outcome?")
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
            throw new Error("The care record did not return a valid source-evidence list.");
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
            throw new Error("No source evidence is saved in this care record yet. Add the relevant source record before you " + requiredAction + ".");
          }
          const choices = sources.slice(0, 20).map((item, index) =>
            `${index + 1}. ${String(item.type)} — ${String(item.source_text ?? "Source text unavailable").slice(0, 110)} [ID: ${String(item.id)}]`,
          ).join("\\n");
          const sourceRequirement = action === "verify"
            ? "Outcome verification requires two persisted, independently originated source records. A caregiver review does not prove semantic entailment or causation."
            : action === "reconcile"
              ? "Contradiction reconciliation requires persisted source evidence. Preserve unresolved disagreement when the sources do not settle it."
              : "A caregiver note alone cannot verify professional input.";
          const sourceId = window.prompt(
            "Select the FIRST existing source record by entering its exact ID. " + sourceRequirement + "\\n\\n" + choices,
          );
          if (!sourceId?.trim()) return;
          const selected = sources.find((item) => item.id === sourceId.trim());
          if (!selected) {
            throw new Error("Choose an exact source ID from the list. No evidence-backed action was saved.");
          }
          selectedSourceId = String(selected.id);
          if (action === "verify") {
            // A persisted pair-level caregiver assessment is required before the backend can record corroboration.
            // This records source independence review, not semantic entailment or proof of causation.
            const secondSourceId = window.prompt(
              "Select a SECOND, independently originated source record by entering its exact ID. It must not be a copy, forwarded record, or another record from the same origin.\\n\\n" + choices,
            );
            if (!secondSourceId?.trim()) return;
            const second = sources.find((item) => item.id === secondSourceId.trim());
            if (!second || second.id === selectedSourceId) {
              throw new Error("Choose a different, existing source record. One source cannot corroborate itself.");
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
              { kind: "care_record_source", evidence_id: selectedSourceId, text: "First persisted source selected by caregiver for independent corroboration." },
              { kind: "care_record_source", evidence_id: String(second.id), text: "Second persisted source selected by caregiver for independent corroboration." },
            ];
          } else {
            evidence = [{
              kind: action === "reconcile" ? "contradiction_reconciliation_source" : "care_record_source",
              evidence_id: selectedSourceId,
              text: action === "reconcile"
                ? "Existing source record selected by caregiver for contradiction reconciliation."
                : "Existing source record selected by caregiver for professional-response verification.",
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
      setNotice(action === "reassess" ? "Reassessment completed by the backend." : "The backend accepted the update. Review the current status below.");
    } catch (reason) {
      setError("The requested change was not confirmed. " + safeMessage(reason));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="mobile-screen open-loops-page">
      <header className="open-loops-header">
        <Link href="/workspace" style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
          <ArrowLeft size={18} aria-hidden /> Back to Living Care Record
        </Link>
        <p className="open-loop-eyebrow">CARE CONTINUITY</p>
        <h1>Things to follow up</h1>
        <p>Keep unfinished care matters visible without having to manage another form. SolenOS preserves what was said and what is still unknown.</p>
      </header>

      <form onSubmit={createLoop} className="open-loop-capture">
        <div className="open-loop-capture-heading">
          <div>
            <p className="open-loop-eyebrow">QUICK CAPTURE</p>
            <h2>What still needs attention?</h2>
            <p>Write it the way you would explain it to someone helping with care. A sentence is enough.</p>
          </div>
        </div>
        <label className="open-loop-capture-label" htmlFor="open-loop-note">Your note</label>
        <textarea
          id="open-loop-note"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          maxLength={12000}
          rows={4}
          placeholder="For example: The clinic said they would call with the test results, but we have not heard back."
        />
        <div className="open-loop-capture-footer">
          <p>SolenOS keeps your words as written. It will not assume a deadline, owner, source, or outcome.</p>
          <Button type="submit" variant="primary" disabled={saving || !description.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="open-loop-list-heading">
        <div className="open-loop-list-heading">
          <h2 id="open-loop-list-heading">Your follow-ups</h2>
          <div className="open-loop-list-controls">
            <select aria-label="Filter open loops" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ minHeight: 40, padding: 8, borderRadius: 8 }}>
              <option value="open">Open</option><option value="waiting">Waiting</option><option value="deferred">Deferred</option><option value="blocked">Blocked</option><option value="review_abandoned">Needs review</option><option value="closed">Verified closed</option><option value="cancelled">Cancelled</option><option value="all">All statuses</option>
            </select>
            <Button variant="secondary" onClick={() => { setLoading(true); void refresh().catch(() => setError("Could not refresh Open Loops.")).finally(() => setLoading(false)); }} disabled={loading}>
              <RefreshCw size={16} aria-hidden /> Refresh
            </Button>
          </div>
        </div>

        {error && <p role="alert" style={{ border: "1px solid #b91c1c", padding: 12, borderRadius: 10 }}>{error}</p>}
        {notice && <p role="status" style={{ border: "1px solid #a3b18a", padding: 12, borderRadius: 10 }}>{notice}</p>}
        {loading ? <p aria-live="polite">Loading saved open loops…</p> :
          visibleLoops.length === 0 ? <div style={{ border: "1px dashed var(--border, #d6d9d3)", borderRadius: 14, padding: 24 }}>
            <CheckCircle2 size={22} aria-hidden /><h3>No items in this view</h3><p>No sample records are shown. If this is unexpected, refresh and check that the correct caregiver session is active.</p>
          </div> : <div style={{ display: "grid", gap: 14 }}>
            {visibleLoops.map((loop) => <article key={loop.id} style={{ border: "1px solid var(--border, #d6d9d3)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.75 }}>{loop.loop_type.replaceAll("_", " ")} · {loop.status.replaceAll("_", " ")}</p>
                  <h3 style={{ margin: "0 0 8px", fontSize: 19 }}>{loop.title}</h3>
                </div>
                <strong>{loop.priority.toUpperCase()}</strong>
              </div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{loop.description}</p>
              <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                <Clock3 size={15} aria-hidden /> {dateLabel(loop.deadline_at)}
                {loop.overdue && <strong style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><AlertCircle size={15} aria-hidden /> Overdue</strong>}
              </p>
              {loop.priority_reasons.length > 0 && <p style={{ fontSize: 13 }}>Why it is flagged: {loop.priority_reasons.join("; ")}</p>}
              {loop.blocking_prerequisites.length > 0 && <p style={{ fontSize: 13 }}>Blocked by: {loop.blocking_prerequisites.map((item) => item.title).join(", ")}</p>}
              {loop.missing_information.length > 0 && <p style={{ fontSize: 13 }}>Still missing: {loop.missing_information.join(", ")}</p>}
              <p style={{ fontSize: 12, opacity: 0.75 }}>Outcome: {loop.outcome_status.replaceAll("_", " ")} · Updated {dateLabel(loop.updated_at)}</p>
              {loop.outcome_status === "outcome_verified" && (
                <p role="note" style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
                  Verification means a caregiver reviewed two persisted sources and explicitly assessed their origins as independent. This records a corroboration assessment; it does not automatically establish semantic entailment, truth, or causation.
                </p>
              )}
              {historyById[loop.id] && <section aria-label={`Audit history for ${loop.title}`} style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-muted, #f6f7f4)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Recorded history</h4>
                {historyById[loop.id].length === 0 ? <p style={{ margin: 0, fontSize: 13 }}>No audit events were returned.</p> :
                  <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                    {historyById[loop.id].map((event) => <li key={event.id} style={{ fontSize: 13 }}>
                      <strong>{event.event_type.replaceAll("_", " ")}</strong> · {dateLabel(event.created_at)}
                      {event.evidence.length > 0 && <p style={{ margin: "4px 0 0" }}>Evidence recorded: {event.evidence.map((item) => String(item.kind ?? item.text ?? "source")).join(", ")}</p>}
                    </li>)}
                  </ol>}
              </section>}
              <details className="open-loop-more-actions">
                <summary>More record actions</summary>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reassess")}>Reassess</Button>
                  <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "history")}>View audit history</Button>
                  {(loop.loop_type === "awaiting_response" || loop.loop_type === "professional_input" || loop.loop_type === "follow_up") && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "response")}>Record response</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "action")}>Record action</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "outcome")}>Record outcome</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "verify")}>Verify outcome</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "dependency")}>Add prerequisite</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "defer")}>Defer decision</Button>}
                  {["open", "waiting"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "review")}>Flag for review</Button>}
                  {loop.loop_type === "contradiction" && !["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reconcile")}>Record reconciliation</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "close")}>Attempt closure</Button>}
                  {!["closed", "cancelled"].includes(loop.status) && <Button variant="secondary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "cancel")}>Cancel pursuit</Button>}
                  {["closed", "cancelled"].includes(loop.status) && <Button variant="primary" disabled={busyId === loop.id} onClick={() => void runAction(loop, "reopen")}>Reopen with reason</Button>}
                </div>
              </details>
            </article>)}
          </div>}
      </section>
    </main>
  );
}
