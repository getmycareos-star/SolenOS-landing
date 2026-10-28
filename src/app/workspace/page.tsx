"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, History, MessageCircle, RefreshCw } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { PersistedCareOrientation } from "@/components/mvp-workspace/PersistedCareOrientation";
import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getJSON } from "@/api/client";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

type CurrentCareItem = Record<string, unknown> & {
  id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  source_type: string;
  source_label: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  evidence_ids?: string[];
  priority: number;
};
type LcrContext = {
  as_of?: string;
  read_only?: boolean;
  projection_type?: string;
  history_coverage?: string;
  schema_status?: string;
  missing_required_sources?: string[];
  missing_optional_sources?: string[];
  items?: CurrentCareItem[];
  item_count?: number;
  has_more?: boolean;
  notice?: string;
  source_coverage?: Record<string, { status?: string; returned_count?: number; has_more?: boolean }>;
};

function displayDate(item: Record<string, unknown>): string {
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
      const result = await getJSON("/care-continuity/current-care?limit_per_source=10");
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

  const currentItems = context?.items ?? [];
  const unavailableRequired = context?.missing_required_sources ?? [];
  const latestDate = context?.as_of ? displayDate({ occurred_at: context.as_of }) : "Date not recorded";

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
            <span>{loading ? "Please wait" : `Record view as of ${latestDate}`}</span>
          </div>
        </header>

        <PersistedCareOrientation />

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
                  {currentItems.map((item) => (
                    <article key={`${item.source_type}:${item.id}`} className="lcr-timeline-item">
                      <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                      <div className="lcr-timeline-content">
                        <div className="lcr-entry-heading">
                          <h3>{item.title || "Care detail"}</h3>
                          <span>{displayDate(item)}</span>
                        </div>
                        {item.description && <p>{item.description}</p>}
                        <span className="lcr-entry-status">{item.kind} · {item.status || "status unknown"}</span>
                        <details className="lcr-expandable">
                          <summary className="panel-muted">Source and record details</summary>
                          <p className="panel-muted">Source: {item.source_label || "Source not recorded"}</p>
                          <p className="panel-muted">Recorded: {item.recorded_at || "Time not recorded"}</p>
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
              {context.notice ?? "This is a bounded view of saved care information, not a clinical conclusion."} History coverage: {context.history_coverage ?? "not specified"}.
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
