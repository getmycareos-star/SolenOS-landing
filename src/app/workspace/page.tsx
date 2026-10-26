"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, CalendarDays, FileText, Plus, Upload, UsersRound, MessageCircle } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { ResearchPreviewAckGate } from "@/components/mvp-workspace/ResearchPreviewAckGate";
import { CognitiveWorkspace } from "@/components/mvp-workspace";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import { listActiveSituations } from "@/lib/ui-runtime";
import { ErrorBoundary } from "@/components/error-boundary";
import { PersistedCareOrientation } from "@/components/mvp-workspace/PersistedCareOrientation";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (sameDay) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
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

  // Read localStorage only after mount — prevents server/client hydration mismatch.
  useEffect(() => {
    try {
      setDisplayName(
        window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE)?.trim() ?? "",
      );
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setDisplayName("");
      setIsArchived(false);
    } finally {
      setArchiveStateLoaded(true);
    }
  }, []);

  const openComposer = useCallback(
    (mode?: string) => {
      router.push(mode ? `/workspace?compose=1&entry=${mode}` : "/workspace?compose=1");
    },
    [router],
  );

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading message="Loading your care context…" />;
  }

  if (isArchived) {
    return (
      <div className="mobile-screen">
        <section className="mobile-care-cards" aria-labelledby="archived-workspace-title">
          <div className="mobile-empty">
            <h1 id="archived-workspace-title" className="mobile-empty-title">Workspace archived on this device</h1>
            <p className="mobile-empty-body">
              This hides the workspace on this device only. It does not delete care information stored by SolenOS or archive it for other caregivers.
            </p>
            {archiveRestoreError && (
              <p role="alert" className="mobile-empty-body">
                {archiveRestoreError}
              </p>
            )}
            <Button
              variant="primary"
              onClick={() => {
                try {
                  window.localStorage.removeItem("solenos_workspace_archived");
                  setArchiveRestoreError("");
                  setIsArchived(false);
                  router.replace("/workspace");
                } catch {
                  // Keep the archived screen visible if the restore flag cannot be cleared.
                  setArchiveRestoreError(
                    "This browser could not restore the workspace because its local storage is unavailable. Your care information has not been deleted. Check browser storage settings and try again.",
                  );
                }
              }}
            >
              Restore workspace
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (compose) {
    return (
      <div className="mobile-screen">
        <div className="mobile-page-head mobile-page-head--back">
          <Button
            variant="icon"
            aria-label="Back to care record"
            onClick={() => router.push("/workspace")}
          >
            <ArrowLeft size={20} aria-hidden />
          </Button>
          <div className="mobile-compose-heading">
            <h2>Add to record</h2>
            <p>Notes, messages, documents, or photos — fragments are fine.</p>
          </div>
        </div>
        <ResearchPreviewAckGate>
          <ErrorBoundary name="CognitiveWorkspace" fallback={
            <div style={{ padding: "24px", textAlign: "center" }}>
              <p style={{ color: "#78716c" }}>The workspace encountered an error. Please try again.</p>
              <Button variant="primary" onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          }>
            <CognitiveWorkspace />
          </ErrorBoundary>
        </ResearchPreviewAckGate>
      </div>
    );
  }

  const activeSituations = listActiveSituations(runtime.situations);
  const situations = [...runtime.situations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const latestUpdated = situations[0]?.updatedAt ?? null;
  const hasAnyContent = situations.length > 0;

  return (
    <div className="mobile-screen">
      <div className="mobile-care-record">
        {/* Header card — name, status pill, last updated */}
        <section className="mobile-care-header" aria-label="Care record summary">
          <div className="mobile-care-name-row">
            <h1 className="mobile-care-name">
              {displayName || "Living Care Record"}
            </h1>
            {activeSituations.length > 0 && (
              <span className="mobile-care-status">
                {STATUS_LABELS[activeSituations[0].status] ?? "Active"}
              </span>
            )}
          </div>
          <p className="mobile-care-meta">
            Last updated: {formatLastUpdated(latestUpdated)}
          </p>
        </section>

        <PersistedCareOrientation />

        <section className="workspace-entry-actions" aria-label="Care record actions">
          <button type="button" className="workspace-entry-action" onClick={() => router.push("/workspace/daily-care")}>
            <CalendarDays size={19} aria-hidden />
            <span><strong>Daily care</strong><small>Record how today is going</small></span>
          </button>
          <button type="button" className="workspace-entry-action" onClick={() => openComposer()}>
            <Plus size={19} aria-hidden />
            <span><strong>Add record</strong><small>Add a note, message, or document</small></span>
          </button>
        </section>

        <section className="workspace-secondary-tools" aria-label="More care tools">
          <button type="button" onClick={() => router.push("/workspace/community")}>
            <UsersRound size={18} aria-hidden />
            <span><strong>Caregiver community</strong><small>Shared dementia-care experiences</small></span>
          </button>
          <button type="button" onClick={() => router.push("/workspace/companion")}>
            <MessageCircle size={18} aria-hidden />
            <span><strong>AI Companion</strong><small>Organise thoughts and questions</small></span>
          </button>
        </section>

        {!hasAnyContent ? (
          /* Empty state — no dead end, real action buttons */
          <section className="mobile-care-cards">
            <div className="mobile-empty">
              <div className="mobile-empty-icon" aria-hidden="true">
                <Activity size={40} />
              </div>
              <h2 className="mobile-empty-title">Your care record is ready.</h2>
              <p className="mobile-empty-body">
                Start by adding information about the person you care for — a
                note, a message, a document, or a photo.
              </p>

            </div>
          </section>
        ) : (
          /* Content as cards */
          <section className="mobile-care-cards" aria-label="Record entries">
            <div className="mobile-page-head">
              <h2>Record</h2>
            </div>
            {situations.map((s) => (
              <article key={s.id} className="mobile-care-card">
                <span className="mobile-care-card-icon" aria-hidden="true">
                  <FileText size={20} />
                </span>
                <div className="mobile-care-card-body">
                  <h3 className="mobile-care-card-title">{s.title}</h3>
                  {s.contextSummary && (
                    <p className="mobile-care-card-line">{s.contextSummary}</p>
                  )}
                  <p className="mobile-care-meta">
                    {STATUS_LABELS[s.status] ?? s.status} · Updated{" "}
                    {formatLastUpdated(s.updatedAt)}
                  </p>
</div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading message="Loading your care context…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}

