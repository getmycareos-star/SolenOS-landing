"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, CalendarDays, FileText, MessageCircle, Plus, Users } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { CognitiveWorkspace } from "@/components/mvp-workspace";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import { listActiveSituations } from "@/lib/ui-runtime";
import { ErrorBoundary } from "@/components/error-boundary";
import { PersistedCareOrientation } from "@/components/mvp-workspace/PersistedCareOrientation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "Not yet updated";
  try {
    const date = new Date(iso);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Not yet updated";
  }
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
  const searchParams = useSearchParams();
  const { runtime, hydrated, entryReady } = useWorkspace();
  const [displayName, setDisplayName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");
  const compose = searchParams.get("compose") === "1";

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

  const openComposer = useCallback(() => {
    router.push("/workspace?compose=1");
  }, [router]);

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading message="Opening your Living Care Record…" />;
  }

  if (isArchived) {
    return (
      <main className="mobile-screen lcr-screen">
        <section className="lcr-empty-state" aria-labelledby="archived-workspace-title">
          <h1 id="archived-workspace-title">Your record is archived on this device</h1>
          <p>This only hides the workspace on this device. It does not delete care information stored by SolenOS.</p>
          {archiveRestoreError && <p role="alert">{archiveRestoreError}</p>}
          <Button
            variant="primary"
            onClick={() => {
              try {
                window.localStorage.removeItem("solenos_workspace_archived");
                setArchiveRestoreError("");
                setIsArchived(false);
                router.replace("/workspace");
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

  if (compose) {
    return (
      <main className="mobile-screen lcr-screen lcr-add-screen">
        <div className="lcr-add-heading">
          <Button variant="icon" aria-label="Back to Living Care Record" onClick={() => router.push("/workspace")}>
            <span aria-hidden="true">←</span>
          </Button>
          <div>
            <p className="lcr-eyebrow">LIVING CARE RECORD</p>
            <h1>Add to the record</h1>
            <p>Notes, messages, documents, or photos. Fragments are fine.</p>
          </div>
        </div>
        <ErrorBoundary name="CognitiveWorkspace" fallback={
          <section className="lcr-empty-state">
            <p>The record entry could not open correctly.</p>
            <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
          </section>
        }>
          <CognitiveWorkspace />
        </ErrorBoundary>
      </main>
    );
  }

  const activeSituations = listActiveSituations(runtime.situations);
  const situations = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latestUpdated = situations[0]?.updatedAt ?? null;
  const hasAnyContent = situations.length > 0;

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">SOLENOS · LIVING CARE RECORD</p>
            <h1>{displayName || "Your care record"}</h1>
            <p className="lcr-intro">The care journey, remembered. Keep the details together, one moment at a time.</p>
          </div>
          <div className="lcr-record-meta">
            <span className="lcr-status-dot" aria-hidden="true" />
            <span>{activeSituations.length > 0 ? (STATUS_LABELS[activeSituations[0].status] ?? "Current") : "Ready when you are"}</span>
            <span className="lcr-meta-divider" aria-hidden="true">·</span>
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <PersistedCareOrientation />

        <section className="lcr-primary-actions" aria-label="Record actions">
          <button type="button" className="lcr-add-primary" onClick={openComposer}>
            <span className="lcr-action-icon" aria-hidden="true"><Plus size={22} /></span>
            <span><strong>Add to record</strong><small>Write a note or add a message, document, or photo</small></span>
            <span className="lcr-action-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="lcr-daily-action" onClick={() => router.push("/workspace/daily-care")}>
            <CalendarDays size={21} aria-hidden="true" />
            <span><strong>Daily care</strong><small>Capture how today is going</small></span>
          </button>
        </section>

        <section className="lcr-record-section" aria-labelledby="lcr-record-heading">
          <div className="lcr-section-heading">
            <div>
              <p className="lcr-eyebrow">YOUR CARE HISTORY</p>
              <h2 id="lcr-record-heading">Record timeline</h2>
            </div>
            {hasAnyContent && <span className="lcr-count">{situations.length} {situations.length === 1 ? "entry" : "entries"}</span>}
          </div>

          {!hasAnyContent ? (
            <div className="lcr-empty-state">
              <div className="lcr-empty-icon" aria-hidden="true"><FileText size={27} /></div>
              <h3>Your record starts with what you know.</h3>
              <p>Add a small detail from today, a message you received, or a document you want to keep connected to the care journey. You do not need to organise it first.</p>
              <button type="button" className="lcr-text-action" onClick={openComposer}>Add the first detail <span aria-hidden="true">→</span></button>
            </div>
          ) : (
            <div className="lcr-timeline">
              {situations.map((situation) => (
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
            </div>
          )}
        </section>

        <section className="lcr-support-section" aria-label="Other care tools">
          <div>
            <p className="lcr-eyebrow">WHEN YOU NEED IT</p>
            <h2>More ways to work with your record</h2>
          </div>
          <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/companion")}>
            <span className="lcr-tool-icon" aria-hidden="true"><MessageCircle size={20} /></span>
            <span><strong>AI Companion</strong><small>Think through care questions using the available context</small></span>
            <span aria-hidden="true">→</span>
          </button>
          {FEATURE_FLAGS.community && FEATURE_FLAGS.professionalCommunity && (
            <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/community")}>
              <span className="lcr-tool-icon" aria-hidden="true"><Users size={20} /></span>
              <span><strong>Caregiver community</strong><small>Learn from other dementia-care experiences</small></span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <p className="lcr-footer-note">Your record brings together what has been shared over time. Suggestions and uncertain information should remain distinguishable from confirmed care details.</p>
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
