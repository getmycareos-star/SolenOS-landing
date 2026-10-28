"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, History, MessageCircle, RefreshCw } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

type LcrItem = Record<string, unknown>;
type LcrSource = { status?: string; items?: LcrItem[]; returned_count?: number; has_more?: boolean };
type LcrContext = {
  as_of?: string;
  read_only?: boolean;
  history_coverage?: string;
  schema_status?: string;
  missing_required_sources?: string[];
  missing_optional_sources?: string[];
  sources?: Record<string, LcrSource>;
};

function displayValue(item: LcrItem, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Care detail";
}

function displayDate(item: LcrItem): string {
  const raw = item.occurred_at ?? item.recorded_at ?? item.effective_at ?? item.created_at;
  if (typeof raw !== "string" || !raw) return "Date not recorded";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? "Date not recorded"
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function WorkspacePageInner() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");
  const [context, setContext] = useState<LcrContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadContext = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const session = await ensureAnonymousSession();
      if (!session?.access_token || !session?.person?.id) {
        throw new Error("A valid care session is required to load the care record.");
      }
      const result = await getJSON("/care-continuity/context?limit_per_source=10");
      if (!result || typeof result !== "object" || !("sources" in result)) {
        throw new Error("The care record response was incomplete. No care details have been assumed.");
      }
      setContext(result as LcrContext);
    } catch (error) {
      setContext(null);
      setLoadError(error instanceof Error ? error.message : "The care record could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    try {
      setDisplayName(window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE)?.trim() ?? "");
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setDisplayName("");
      setIsArchived(false);
    } finally {
      setArchiveStateLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (archiveStateLoaded && !isArchived) void loadContext();
  }, [archiveStateLoaded, isArchived, loadContext]);

  if (!archiveStateLoaded) {
    return <BrandLoading message="Opening your Living Care Record…" />;
  }

  if (isArchived) {
    return (
      <main className="mobile-screen lcr-screen">
        <section className="lcr-empty-state" aria-labelledby="archived-workspace-title">
          <h1 id="archived-workspace-title">Your record is hidden on this device</h1>
          <p>Hiding this workspace on this device does not delete care information stored by SolenOS.</p>
          {archiveRestoreError && <p role="alert">{archiveRestoreError}</p>}
          <Button variant="primary" onClick={() => {
            try {
              window.localStorage.removeItem("solenos_workspace_archived");
              setArchiveRestoreError("");
              setIsArchived(false);
            } catch {
              setArchiveRestoreError("This browser could not restore the workspace. Your care information has not been deleted.");
            }
          }}>Restore my record</Button>
        </section>
      </main>
    );
  }

  const sources = context?.sources ?? {};
  const eventItems = sources.events?.items ?? [];
  const factItems = sources.facts?.items ?? [];
  const assertionItems = sources.assertions?.items ?? [];
  const decisionItems = sources.decisions?.items ?? [];
  const conflictItems = sources.conflicts?.items ?? [];
  const uncertaintyItems = sources.uncertainties?.items ?? [];
  const missingItems = sources.missing_information?.items ?? [];
  const currentItems = [
    ...conflictItems.map((item) => ({ item, kind: "Conflict" })),
    ...uncertaintyItems.filter((item) => item.status !== "resolved").map((item) => ({ item, kind: "Needs clarification" })),
    ...missingItems.filter((item) => item.status !== "resolved" && item.status !== "completed").map((item) => ({ item, kind: "Information missing" })),
    ...eventItems.filter((item) => item.status !== "resolved" && item.status !== "completed").slice(0, 4).map((item) => ({ item, kind: "Care event" })),
    ...factItems.filter((item) => !item.superseded_by_fact_id).slice(0, 3).map((item) => ({ item, kind: "Recorded fact" })),
    ...assertionItems.filter((item) => item.assertion_status !== "retracted" && item.assertion_status !== "superseded").slice(0, 3).map((item) => ({ item, kind: "Reported information" })),
    ...decisionItems.filter((item) => item.decision_status !== "resolved" && item.decision_status !== "completed").slice(0, 2).map((item) => ({ item, kind: "Decision" })),
  ].slice(0, 8);
  const unavailableRequired = context?.missing_required_sources ?? [];
  const latestDate = eventItems.map((item) => displayDate(item))[0] ?? "Date not recorded";

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">SOLENOS · LIVING CARE RECORD</p>
            <h1>{displayName || "Your care record"}</h1>
            <p className="lcr-intro">A clear view of what matters now, with the full care history kept together.</p>
          </div>
          <div className="lcr-record-meta">
            <span className="lcr-status-dot" aria-hidden="true" />
            <span>{loading ? "Loading care context" : loadError ? "Care context unavailable" : context?.schema_status === "complete" ? "Care context loaded" : "Some care sources unavailable"}</span>
            <span className="lcr-meta-divider" aria-hidden="true">·</span>
            <span>{loading ? "Please wait" : `Latest event: ${latestDate}`}</span>
          </div>
        </header>

        <section className="lcr-primary-actions" aria-label="Care record navigation">
          <button type="button" className="lcr-daily-action" onClick={() => router.push("/workspace/daily-care")}>
            <CalendarDays size={21} aria-hidden="true" />
            <span><strong>Daily Care</strong><small>Record today's observations and care events</small></span>
            <span className="lcr-action-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/timeline")}>
            <span className="lcr-tool-icon" aria-hidden="true"><History size={20} /></span>
            <span><strong>Longitudinal Care History</strong><small>Review earlier events and changes over time</small></span>
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section className="lcr-record-section" aria-labelledby="current-care-heading">
          <div className="lcr-section-heading">
            <div>
              <p className="lcr-eyebrow">CURRENT CARE REALITY</p>
              <h2 id="current-care-heading">What matters now</h2>
            </div>
            {currentItems.length > 0 && <span className="lcr-count">{currentItems.length} items</span>}
          </div>

          {loading ? (
            <div className="lcr-empty-state" role="status"><p>Loading saved care information…</p></div>
          ) : loadError ? (
            <div className="lcr-empty-state" role="alert">
              <h3>Your care record could not be loaded.</h3>
              <p>{loadError}</p>
              <button type="button" className="lcr-text-action" onClick={() => void loadContext(true)} disabled={refreshing}>
                <RefreshCw size={16} aria-hidden="true" /> {refreshing ? "Trying again…" : "Try again"}
              </button>
            </div>
          ) : (
            <>
              {unavailableRequired.length > 0 && (
                <p className="panel-muted" role="status">Some required care sources are unavailable. This view may be incomplete; do not treat it as a complete account of care.</p>
              )}
              {currentItems.length === 0 ? (
                <div className="lcr-empty-state">
                  <div className="lcr-empty-icon" aria-hidden="true"><FileText size={27} /></div>
                  <h3>No current care items are available to show.</h3>
                  <p>This does not mean there are no care needs. Use Daily Care to record observations, or open the history to review saved events.</p>
                  <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/daily-care")}>Open Daily Care <span aria-hidden="true">→</span></button>
                </div>
              ) : (
                <div className="lcr-timeline">
                  {currentItems.map(({ item, kind }, index) => (
                    <article key={String(item.id ?? `${kind}-${index}`)} className="lcr-timeline-item">
                      <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                      <div className="lcr-timeline-content">
                        <div className="lcr-entry-heading">
                          <h3>{displayValue(item, "title", "fact_type", "field", "topic", "question", "description", "conflict_type")}</h3>
                          <span>{displayDate(item)}</span>
                        </div>
                        <p>{displayValue(item, "description", "fact_value", "asserted_value", "decision_text", "question", "resolution")}</p>
                        <span className="lcr-entry-status">{kind} · {displayValue(item, "epistemic_status", "assertion_status", "status", "decision_status")}</span>
                        <details className="lcr-expandable">
                          <summary className="panel-muted">Source and record details</summary>
                          <p className="panel-muted">Source: {displayValue(item, "source_label", "source_type", "author_label", "created_by_caregiver_id")}</p>
                          <p className="panel-muted">Recorded: {displayValue(item, "recorded_at", "created_at")}</p>
                          {Array.isArray(item.evidence_ids) && item.evidence_ids.length > 0 && <p className="panel-muted">Linked evidence: {item.evidence_ids.length} item(s)</p>}
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {context && (
            <p className="lcr-footer-note">
              This view is based on a bounded read of saved care sources, not a clinical conclusion. History coverage: {context.history_coverage ?? "not specified"}.
              {context.schema_status !== "complete" ? " Some sources may be unavailable." : ""}
            </p>
          )}
        </section>

        <section className="lcr-support-section" aria-label="Specialized care tools">
          <div>
            <p className="lcr-eyebrow">SPECIALIZED TOOLS</p>
            <h2>Work with care information</h2>
          </div>
          <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/companion")}>
            <span className="lcr-tool-icon" aria-hidden="true"><MessageCircle size={20} /></span>
            <span><strong>AI Companion</strong><small>Explore care questions using available context</small></span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/documents")}>
            <span className="lcr-tool-icon" aria-hidden="true"><FileText size={20} /></span>
            <span><strong>Document AI</strong><small>Upload, review, and understand care documents</small></span>
            <span aria-hidden="true">→</span>
          </button>
          {FEATURE_FLAGS.community && FEATURE_FLAGS.professionalCommunity && (
            <p className="panel-muted">Community is separate from the authoritative Living Care Record.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading message="Opening your Living Care Record…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
