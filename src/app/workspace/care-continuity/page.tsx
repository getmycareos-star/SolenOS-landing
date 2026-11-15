"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

import { BrandLoading } from "@/components/brand";
import { useWorkspace } from "@/lib/workspace-context";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";

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

function WorkspacePageInner() {
  const router = useRouter();
  const { runtime, hydrated, entryReady } = useWorkspace();
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");
  useEffect(() => {
    try {
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setIsArchived(false);
    } finally {
      setArchiveStateLoaded(true);
    }
  }, []);

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading animate message="Opening your Care Record…" />;
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

  const latestUpdated = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt ?? null;

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">YOUR CARE RECORD</p>
            <h1>Your Care Record</h1>
            <p className="lcr-intro">See what is currently understood about care, what still needs checking and where the information came from.</p>
          </div>
          <div className="lcr-record-meta">
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <section className="lcr-current-fact lcr-companion-entry" aria-labelledby="lcr-companion-entry-heading">
          <div>
            <h2 id="lcr-companion-entry-heading">Need to add something?</h2>
            <p>Record a new observation or change in Daily Care. Review suggested changes before they become part of your Care Record.</p>
          </div>
          <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/daily-care")}>
            Open Daily Care <span aria-hidden="true">→</span>
          </button>
        </section>

        <LCRCurrentUnderstanding />

        <section
          aria-label="Care Record actions"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: 18, border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "var(--solenos-surface)" }}
        >
          <div>
            <h2 style={{ margin: "0 0 5px", fontSize: 16 }}>Keep your care information up to date</h2>
            <p style={{ margin: 0, color: "var(--solenos-muted)", fontSize: 13, lineHeight: 1.5 }}>
              Record something new in Daily Care, or open the Timeline when you need to review earlier updates.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={() => router.push("/workspace/daily-care")}
              style={{ minHeight: 42, padding: "9px 15px", border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", font: "inherit", fontWeight: 600, cursor: "pointer" }}
            >
              Add a care update
            </button>
            <button type="button" className="lcr-text-action lcr-record-timeline-action" onClick={() => router.push("/workspace/timeline")}>
              View care timeline <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>


      </div>
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening your Care Record…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
