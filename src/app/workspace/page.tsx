"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, History, MessageCircle } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import { listActiveSituations } from "@/lib/ui-runtime";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "Not yet updated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  active: "Current",
  blocked: "Needs attention",
  waiting: "Waiting",
  paused: "Paused",
  resolved: "Resolved",
};

function WorkspacePageInner() {
  const router = useRouter();
  const { runtime, hydrated, entryReady } = useWorkspace();
  const [displayName, setDisplayName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");

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

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading message="Opening your Living Care Record…" />;
  }

  if (isArchived) {
    return (
      <main className="mobile-screen lcr-screen">
        <section className="lcr-empty-state" aria-labelledby="archived-workspace-title">
          <h1 id="archived-workspace-title">Your record is hidden on this device</h1>
          <p>Hiding this workspace on this device does not delete care information stored by SolenOS.</p>
          {archiveRestoreError && <p role="alert">{archiveRestoreError}</p>}
          <Button
            variant="primary"
            onClick={() => {
              try {
                window.localStorage.removeItem("solenos_workspace_archived");
                setArchiveRestoreError("");
                setIsArchived(false);
              } catch {
                setArchiveRestoreError("This browser could not restore the workspace. Your care information has not been deleted.");
              }
            }}
          >
            Restore my record
          </Button>
        </section>
      </main>
    );
  }

  const activeSituations = listActiveSituations(runtime.situations);
  const recentSituations = [...runtime.situations]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const latestUpdated = recentSituations[0]?.updatedAt ?? null;

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
            <span>{activeSituations.length > 0 ? "Current care context available" : "No current care context shown"}</span>
            <span className="lcr-meta-divider" aria-hidden="true">·</span>
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
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
            <span><strong>Longitudinal Care History</strong><small>Review earlier events, decisions, and changes over time</small></span>
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section className="lcr-record-section" aria-labelledby="current-care-heading">
          <div className="lcr-section-heading">
            <div>
              <p className="lcr-eyebrow">CURRENT CARE REALITY</p>
              <h2 id="current-care-heading">What matters now</h2>
            </div>
            {activeSituations.length > 0 && (
              <span className="lcr-count">{activeSituations.length} current {activeSituations.length === 1 ? "item" : "items"}</span>
            )}
          </div>

          {activeSituations.length === 0 ? (
            <div className="lcr-empty-state">
              <div className="lcr-empty-icon" aria-hidden="true"><FileText size={27} /></div>
              <h3>No current care items are available here yet.</h3>
              <p>When you record care through Daily Care, return here to review the available context. You can also open the longitudinal history to review existing events.</p>
              <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/daily-care")}>
                Open Daily Care <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <div className="lcr-timeline">
              {activeSituations.slice(0, 4).map((situation) => (
                <article key={situation.id} className="lcr-timeline-item">
                  <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                  <div className="lcr-timeline-content">
                    <div className="lcr-entry-heading">
                      <h3>{situation.title}</h3>
                      <span>{formatLastUpdated(situation.updatedAt)}</span>
                    </div>
                    {situation.contextSummary && <p>{situation.contextSummary}</p>}
                    <span className="lcr-entry-status">{STATUS_LABELS[situation.status] ?? situation.status}</span>
                  </div>
                </article>
              ))}
              {activeSituations.length > 4 && (
                <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/timeline")}>
                  Review all history <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          )}
          <p className="lcr-footer-note">This view shows the care context currently available to the workspace. Source details, uncertainty, and historical changes must remain visible in the underlying record; a newer report does not automatically make an older one false.</p>
        </section>

        {recentSituations.some((situation) => situation.status === "resolved") && (
          <section className="lcr-support-section" aria-label="Recent context">
            <div>
              <p className="lcr-eyebrow">RECENTLY UPDATED</p>
              <h2>Recent care context</h2>
            </div>
            {recentSituations.filter((situation) => situation.status === "resolved").slice(0, 2).map((situation) => (
              <article key={situation.id} className="lcr-timeline-item">
                <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                <div className="lcr-timeline-content">
                  <div className="lcr-entry-heading">
                    <h3>{situation.title}</h3>
                    <span>{formatLastUpdated(situation.updatedAt)}</span>
                  </div>
                  {situation.contextSummary && <p>{situation.contextSummary}</p>}
                  <span className="lcr-entry-status">{STATUS_LABELS[situation.status] ?? situation.status}</span>
                </div>
              </article>
            ))}
          </section>
        )}

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
            <p className="panel-muted">Community is not part of the Living Care Record workflow.</p>
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
