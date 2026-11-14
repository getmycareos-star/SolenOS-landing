"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

type EvidenceRef = Record<string, unknown>;

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
  evidence: EvidenceRef[];
  response_evidence: EvidenceRef[];
  outcome_evidence: EvidenceRef[];
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

type CareItem = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  status: string;
  epistemic_status: string;
  source_collection: string;
  source_type: string;
  source_label: string;
  occurred_at: string | null;
  reported_at: string | null;
  recorded_at: string | null;
  due_at: string | null;
  evidence_ids: string[];
  claim_count: number;
};

type CareProjection = {
  as_of: string | null;
  projection_type: string;
  read_only: boolean;
  history_coverage: string;
  schema_status: string;
  missing_required_sources: string[];
  missing_optional_sources: string[];
  items: CareItem[];
  item_count: number;
  has_more: boolean;
  source_coverage: Record<string, { status?: string; returned_count?: number; has_more?: boolean }>;
  notice?: string;
};

type LoadState = "loading" | "ready" | "partial" | "error";

const openStatus = new Set([
  "open",
  "waiting",
  "deferred",
  "blocked",
  "review_abandoned",
  "pending_closure_verification",
]);

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? caregiverSafeAssistantText(value) || fallback : fallback;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value: string): string {
  return caregiverStatusLabel(value) || value.replaceAll("_", " ");
}

function priorityLabel(value: string): string {
  if (value === "critical" || value === "high") return "Needs attention";
  if (value === "low") return "Low priority";
  return "Being monitored";
}

function isClarificationItem(item: CareItem): boolean {
  const kind = item.kind.toLowerCase();
  return kind.includes("clarification")
    || kind.includes("conflict")
    || kind.includes("reconciliation")
    || kind.includes("information missing");
}

function sourceDate(item: CareItem): string | null {
  return item.occurred_at || item.reported_at || item.recorded_at;
}

function CareItemCard({ item }: { item: CareItem }) {
  const [expanded, setExpanded] = useState(false);
  const prompt = [
    "Help me understand this item in the person's Living Care Record.",
    "Do not assume missing information or turn a report into a verified fact.",
    "Item: " + item.title,
    "Details: " + item.description,
    "Source: " + item.source_label + " (" + item.source_collection + ")",
    "Evidence references: " + (item.evidence_ids || []).join(", "),
  ].join("\n");

  return (
    <article className="followup-card">
      <div className="followup-card-heading">
        <div>
          <p className="followup-eyebrow">{safeText(item.kind, "Care record item")} · {safeText(item.source_label, "Source not recorded")}</p>
          <h3>{safeText(item.title, "Care information needs review")}</h3>
        </div>
        <span className="followup-status">{safeText(item.epistemic_status, "Status not established").replaceAll("_", " ")}</span>
      </div>
      <p className="followup-description">{safeText(item.description, "No further details are available in this record.")}</p>
      <div className="followup-meta">
        <span><Clock3 size={14} /> {dateLabel(sourceDate(item))}</span>
        <span><FileText size={14} /> {(item.evidence_ids || []).length} linked source(s)</span>
      </div>
      {expanded && (
        <div className="followup-detail">
          <p><strong>What SolenOS found</strong><br />{safeText(item.kind, "Care record item")} in {safeText(item.source_collection, "the available care history")}.</p>
          <p><strong>What remains known</strong><br />{safeText(item.epistemic_status, "The status has not been established").replaceAll("_", " ")}. This describes the record, not an independent clinical conclusion.</p>
          <p><strong>Source references</strong><br />{(item.evidence_ids || []).length ? item.evidence_ids.join(", ") : "No linked evidence references were returned."}</p>
        </div>
      )}
      <div className="followup-card-actions">
        <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "See why this appeared"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <Link className="followup-secondary-button" href={"/workspace/companion?prompt=" + encodeURIComponent(prompt)}>
          <MessageCircle size={15} /> Ask SolenOS
        </Link>
      </div>
    </article>
  );
}

function OpenLoopCard({
  loop,
  onUpdate,
  busy,
}: {
  loop: OpenLoop;
  onUpdate: (loop: OpenLoop, text: string) => Promise<void>;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);
  const resolved = loop.status === "closed";

  return (
    <article className="followup-card">
      <div className="followup-card-heading">
        <div>
          <p className="followup-eyebrow">{safeText(loop.loop_type, "Care follow-up").replaceAll("_", " ")} · {statusLabel(loop.status)}</p>
          <h3>{safeText(loop.title, "Care matter")}</h3>
        </div>
        <span className={"followup-status" + (loop.overdue ? " is-warning" : "")}>
          {loop.overdue ? "Past recorded date" : priorityLabel(loop.priority)}
        </span>
      </div>
      <p className="followup-description">{safeText(loop.description, "No further details are available.")}</p>
      {loop.priority_reasons?.length > 0 && (
        <p className="followup-reason"><AlertCircle size={14} /> {loop.priority_reasons.map((reason) => safeText(reason)).filter(Boolean).join(" · ")}</p>
      )}
      {loop.missing_information?.length > 0 && (
        <p className="followup-muted">Still unclear: {loop.missing_information.map((item) => safeText(item)).filter(Boolean).join(", ")}</p>
      )}
      <div className="followup-meta">
        <span><Clock3 size={14} /> First recorded {dateLabel(loop.created_at)}</span>
        <span><FileText size={14} /> {(loop.evidence || []).length + (loop.outcome_evidence || []).length} linked update(s)</span>
      </div>
      {expanded && (
        <div className="followup-detail">
          <p><strong>Why this is being tracked</strong><br />{loop.priority_reasons?.length ? loop.priority_reasons.map((reason) => safeText(reason)).filter(Boolean).join("; ") : "It remains open in the care record. No additional urgency has been established."}</p>
          <p><strong>Latest record change</strong><br />{dateLabel(loop.updated_at)}</p>
          <p><strong>Outcome status</strong><br />{statusLabel(loop.outcome_status)}</p>
          <p><strong>Evidence</strong><br />{(loop.evidence || []).length + (loop.response_evidence || []).length + (loop.outcome_evidence || []).length} saved evidence or update entries. A caregiver-reported update is not independent verification.</p>
          {loop.deadline_at && <p><strong>Recorded date</strong><br />{dateLabel(loop.deadline_at)} · Source: {safeText(loop.deadline_source, "Not recorded")}</p>}
        </div>
      )}
      {!resolved && !["cancelled"].includes(loop.status) && (
        <div className="followup-update-area">
          {showUpdate ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              if (updateText.trim()) void onUpdate(loop, updateText.trim()).then(() => {
                setUpdateText("");
                setShowUpdate(false);
              });
            }}>
              <label htmlFor={"followup-update-" + loop.id}>What has changed? SolenOS will save this as your report, not as a verified outcome.</label>
              <textarea id={"followup-update-" + loop.id} rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} maxLength={12000} placeholder="Share an update in your own words…" />
              <div className="followup-card-actions">
                <button type="button" className="followup-text-button" onClick={() => setShowUpdate(false)}>Cancel</button>
                <button type="submit" className="followup-primary-button" disabled={busy || !updateText.trim()}>{busy ? "Saving…" : "Share update"}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="followup-text-button" onClick={() => setShowUpdate(true)}>Share an update</button>
          )}
        </div>
      )}
      <div className="followup-card-actions">
        <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide details" : "See details"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </article>
  );
}

export default function FollowUpsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [projection, setProjection] = useState<CareProjection | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await ensureAnonymousSession();
      const [loopResult, careResult] = await Promise.allSettled([
        getJSON("/open-loops?limit=100"),
        getJSON("/care-continuity/current-care?limit_per_source=20"),
      ]);
      const nextLoops = loopResult.status === "fulfilled"
        && Array.isArray((loopResult.value as { items?: unknown }).items)
        ? (loopResult.value as { items: OpenLoop[] }).items
        : null;
      const nextProjection = careResult.status === "fulfilled"
        && Array.isArray((careResult.value as { items?: unknown }).items)
        ? careResult.value as CareProjection
        : null;

      if (!nextLoops && !nextProjection) {
        throw new Error("Neither follow-up records nor the current care projection could be loaded.");
      }
      setLoops(nextLoops || []);
      setProjection(nextProjection);
      setLoadState(nextLoops && nextProjection ? "ready" : "partial");
      if (!nextLoops || !nextProjection) {
        setError("Some care information could not be loaded. The view is incomplete; unavailable information is not treated as empty or resolved.");
      }
    } catch {
      setLoadState("error");
      setError("Follow-ups could not be loaded from the care record. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const categorized = useMemo(() => {
    const careItems = projection?.items || [];
    const clarificationItems = careItems.filter(isClarificationItem);
    const attentionItems = careItems.filter((item) => !isClarificationItem(item)
      && (item.kind.toLowerCase().includes("follow-up")
        || item.kind.toLowerCase().includes("open question")
        || item.kind.toLowerCase().includes("needing attention")));
    const resolvedLoops = loops.filter((loop) => loop.status === "closed");
    const stoppedLoops = loops.filter((loop) => loop.status === "cancelled");
    const openLoops = loops.filter((loop) => openStatus.has(loop.status));
    const urgentLoops = openLoops.filter((loop) => loop.overdue || ["critical", "high"].includes(loop.priority));
    const monitoredLoops = openLoops.filter((loop) => !urgentLoops.includes(loop));
    return {
      needsAttention: attentionItems,
      clarification: clarificationItems,
      urgentLoops,
      monitoredLoops,
      resolvedLoops,
      stoppedLoops,
    };
  }, [loops, projection]);

  async function shareUpdate(loop: OpenLoop, text: string) {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    try {
      await postJSON("/open-loops/" + encodeURIComponent(loop.id) + "/outcomes", {
        text,
        evidence: [],
        idempotency_key: crypto.randomUUID(),
      });
      await refresh();
      setNotice("Your update was saved as a caregiver report. SolenOS has not marked the matter resolved.");
    } catch {
      setError("The update could not be confirmed. Nothing has been marked resolved.");
    } finally {
      setBusyId("");
    }
  }

  const projectionIsBounded = Boolean(projection && (
    projection.history_coverage !== "complete"
    || projection.has_more
    || projection.missing_required_sources?.length
    || projection.missing_optional_sources?.length
  ));

  return (
    <main className="mobile-screen followups-page">
      <header className="followups-header">
        <Link href="/workspace" className="followups-back"><ArrowLeft size={17} /> Living Care Record</Link>
        <div className="followups-kicker"><Sparkles size={15} /> SOLENOS CARE CONTINUITY</div>
        <div className="followups-title-row">
          <div>
            <h1>Follow-ups</h1>
            <p>SolenOS keeps track of unresolved care matters so you do not have to manage them yourself.</p>
          </div>
          <button type="button" className="followups-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh follow-ups">
            <RefreshCw size={17} className={loading ? "followups-spin" : ""} />
          </button>
        </div>
      </header>

      {error && <p className="followups-alert" role="alert">{error}</p>}
      {notice && <p className="followups-notice" role="status">{notice}</p>}
      {projectionIsBounded && (
        <p className="followups-limitation" role="note">
          This view covers the care information currently available to SolenOS. Some sources or older records may not be included, so an empty section does not prove that nothing remains unresolved.
        </p>
      )}

      {loadState === "loading" ? (
        <section className="followups-empty" aria-live="polite">Reviewing the available care history…</section>
      ) : loadState === "error" ? (
        <section className="followups-empty">
          <AlertCircle size={22} />
          <h2>Care history is unavailable</h2>
          <p>SolenOS cannot safely determine what remains unresolved until the saved care information can be loaded.</p>
          <button type="button" className="followup-primary-button" onClick={() => void refresh()}>Try again</button>
        </section>
      ) : (
        <>
          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Needs attention</h2><p>Matters in the saved history that may need a closer look.</p></div>
              <span>{categorized.needsAttention.length + categorized.urgentLoops.length}</span>
            </div>
            {categorized.urgentLoops.map((loop) => <OpenLoopCard key={loop.id} loop={loop} onUpdate={shareUpdate} busy={busyId === loop.id} />)}
            {categorized.needsAttention.map((item) => <CareItemCard key={item.source_collection + ":" + item.id} item={item} />)}
            {categorized.urgentLoops.length + categorized.needsAttention.length === 0 && <p className="followups-empty-inline">No matters requiring immediate attention were identified in the available records.</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Being monitored</h2><p>Open matters that remain in the care record without a recorded urgent reason.</p></div>
              <span>{categorized.monitoredLoops.length}</span>
            </div>
            {categorized.monitoredLoops.map((loop) => <OpenLoopCard key={loop.id} loop={loop} onUpdate={shareUpdate} busy={busyId === loop.id} />)}
            {categorized.monitoredLoops.length === 0 && <p className="followups-empty-inline">No open follow-ups are currently being monitored in this view.</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Needs clarification</h2><p>Unclear, missing or conflicting information. SolenOS will not guess which account is correct.</p></div>
              <span>{categorized.clarification.length}</span>
            </div>
            {categorized.clarification.map((item) => <CareItemCard key={item.source_collection + ":" + item.id} item={item} />)}
            {categorized.clarification.length === 0 && <p className="followups-empty-inline">No clarification items were returned by the available care-history sources.</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Resolved</h2><p>Items closed in the care record after their required review.</p></div>
              <span>{categorized.resolvedLoops.length}</span>
            </div>
            {categorized.resolvedLoops.map((loop) => <OpenLoopCard key={loop.id} loop={loop} onUpdate={shareUpdate} busy={busyId === loop.id} />)}
            {categorized.stoppedLoops.length > 0 && (
              <div className="followups-stopped-note"><strong>Stopped, not resolved</strong><p>{categorized.stoppedLoops.length} item(s) were stopped. They are not represented as verified outcomes.</p></div>
            )}
            {categorized.resolvedLoops.length === 0 && <p className="followups-empty-inline">No verified closures are recorded here.</p>}
          </section>
        </>
      )}
      <style jsx>{`
        .followups-page { max-width: 900px; margin: 0 auto; padding: 24px 18px 64px; color: var(--text, #1f2a22); }
        .followups-header { margin-bottom: 24px; }
        .followups-back { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 22px; color: var(--text-secondary, #536157); text-decoration: none; font-size: 14px; }
        .followups-kicker { display: flex; align-items: center; gap: 7px; color: var(--text-secondary, #657568); font-size: 11px; font-weight: 750; letter-spacing: .12em; }
        .followups-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 8px; }
        .followups-title-row h1 { margin: 0; font-size: clamp(32px, 6vw, 42px); line-height: 1.1; letter-spacing: -.035em; }
        .followups-title-row p { max-width: 650px; margin: 9px 0 0; color: var(--text-secondary, #5b665d); line-height: 1.6; }
        .followups-refresh { flex: 0 0 auto; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--border, #d9dfd8); border-radius: 12px; background: var(--surface, #fff); color: var(--text, #1f2a22); }
        .followups-spin { animation: followups-spin 1s linear infinite; }
        @keyframes followups-spin { to { transform: rotate(360deg); } }
        .followups-alert, .followups-notice, .followups-limitation { border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
        .followups-alert { border: 1px solid #c78d78; background: #fff8f5; color: #713d2b; }
        .followups-notice { border: 1px solid #a8c1a5; background: #f4f8f2; color: #29452d; }
        .followups-limitation { border: 1px solid var(--border, #d9dfd8); background: var(--surface-muted, #f6f8f5); color: var(--text-secondary, #5b665d); }
        .followups-section { display: grid; gap: 12px; margin-top: 28px; }
        .followups-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .followups-section-heading h2 { margin: 0; font-size: 20px; }
        .followups-section-heading p { margin: 4px 0 0; color: var(--text-secondary, #647067); font-size: 13px; line-height: 1.45; }
        .followups-section-heading > span { display: grid; place-items: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 999px; background: var(--surface-muted, #edf2eb); font-size: 13px; font-weight: 700; }
        .followup-card { border: 1px solid var(--border, #d9dfd8); border-radius: 15px; background: var(--surface, #fff); padding: 16px; display: grid; gap: 10px; }
        .followup-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .followup-eyebrow { margin: 0 0 5px; color: var(--text-secondary, #667269); font-size: 11px; text-transform: uppercase; letter-spacing: .055em; }
        .followup-card h3 { margin: 0; font-size: 17px; line-height: 1.35; }
        .followup-status { flex: 0 0 auto; max-width: 145px; padding: 5px 8px; border-radius: 999px; background: var(--surface-muted, #edf2eb); color: var(--text-secondary, #4f5d51); font-size: 11px; font-weight: 700; text-align: center; }
        .followup-status.is-warning { background: #fff2e9; color: #874b2d; }
        .followup-description { margin: 0; white-space: pre-wrap; line-height: 1.55; font-size: 14px; }
        .followup-meta { display: flex; flex-wrap: wrap; gap: 12px; color: var(--text-secondary, #647067); font-size: 12px; }
        .followup-meta span, .followup-reason { display: inline-flex; align-items: center; gap: 6px; }
        .followup-reason { margin: 0; color: #81502f; font-size: 13px; line-height: 1.45; }
        .followup-muted { margin: 0; color: var(--text-secondary, #647067); font-size: 13px; }
        .followup-detail { border-top: 1px solid var(--border, #e1e5df); padding-top: 10px; display: grid; gap: 8px; }
        .followup-detail p { margin: 0; font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
        .followup-card-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .followup-text-button, .followup-secondary-button, .followup-primary-button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 8px 12px; font-size: 13px; font-weight: 650; cursor: pointer; text-decoration: none; }
        .followup-text-button { border: 0; background: transparent; color: var(--text, #263329); }
        .followup-secondary-button { border: 1px solid var(--border, #d9dfd8); background: var(--surface, #fff); color: var(--text, #263329); }
        .followup-primary-button { border: 1px solid #8eae8a; background: #b9d5b5; color: #17251c; }
        .followup-primary-button:disabled { opacity: .55; cursor: not-allowed; }
        .followup-update-area { border-top: 1px solid var(--border, #e1e5df); padding-top: 12px; }
        .followup-update-area form { display: grid; gap: 9px; }
        .followup-update-area label { font-size: 12px; color: var(--text-secondary, #5b665d); line-height: 1.5; }
        .followup-update-area textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border, #cfd8cf); border-radius: 9px; padding: 10px; background: var(--surface, #fff); color: var(--text, #1f2a22); font: inherit; resize: vertical; }
        .followups-empty, .followups-empty-inline { border: 1px dashed var(--border, #d9dfd8); border-radius: 13px; padding: 20px; color: var(--text-secondary, #647067); line-height: 1.55; }
        .followups-empty { display: grid; justify-items: start; gap: 8px; }
        .followups-empty h2 { margin: 0; color: var(--text, #263329); font-size: 18px; }
        .followups-empty p { margin: 0 0 6px; }
        .followups-empty-inline { margin: 0; font-size: 13px; padding: 14px; }
        .followups-stopped-note { border: 1px solid var(--border, #d9dfd8); border-radius: 12px; padding: 12px 14px; }
        .followups-stopped-note p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary, #647067); }
        @media (max-width: 560px) {
          .followups-page { padding: 18px 13px 48px; }
          .followup-card { padding: 13px; }
          .followup-card-heading { display: grid; }
          .followup-status { justify-self: start; }
        }
      `}</style>
    </main>
  );
}
