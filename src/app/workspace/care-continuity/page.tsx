"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

import { BrandLoading } from "@/components/brand";
import { useWorkspace } from "@/lib/workspace-context";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { CARE_INFORMATION_NAVIGATION } from "@/lib/workspace-navigation";

function formatLastUpdated(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
    return <BrandLoading animate message="Opening Care information…" />;
  }

  if (isArchived) {
    return (
      <div className="mobile-screen lcr-screen">
        <section className="lcr-empty-state" aria-labelledby="archived-workspace-title">
          <h1 id="archived-workspace-title">Your Care Record is stored on this device</h1>
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
      </div>
    );
  }

  const latestUpdated = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt ?? null;

  return (
    <div className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">YOUR CARE RECORD</p>
            <h1>Care information</h1>
            <p className="lcr-intro">Find the current care picture, earlier events, documents and the care matters that still need attention.</p>
          </div>
          <div className="lcr-record-meta">
            {latestUpdated && formatLastUpdated(latestUpdated) && <span>Care summary updated {formatLastUpdated(latestUpdated)}</span>}
          </div>
        </header>

        <section className="care-information-directory" aria-labelledby="care-information-directory-heading">
          <div className="care-information-directory__intro">
            <h2 id="care-information-directory-heading">Explore care information</h2>
            <p>Each area has a different purpose. Your saved care information stays connected across these views.</p>
          </div>
          <nav className="care-information-directory__grid" aria-label="Care information sections">
            {CARE_INFORMATION_NAVIGATION.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="care-information-directory__link"
                  aria-labelledby={`care-information-${item.id}-label`}
                  aria-describedby={`care-information-${item.id}-description`}
                >
                  <span className="care-information-directory__icon" aria-hidden="true"><Icon size={19} /></span>
                  <span className="care-information-directory__copy">
                    <strong id={`care-information-${item.id}-label`}>{item.label}</strong>
                    <span id={`care-information-${item.id}-description`}>{item.description}</span>
                  </span>
                  <span className="care-information-directory__arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </nav>
        </section>
        <section className="lcr-current-fact lcr-companion-entry" aria-labelledby="lcr-companion-entry-heading">
          <div>
            <h2 id="lcr-companion-entry-heading">Need to add something?</h2>
            <p>Record a new observation, document or change. Review suggested changes before they become part of your Care Record.</p>
          </div>
          <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/daily-care")}>
            Add an update <span aria-hidden="true">→</span>
          </button>
        </section>

        <LCRCurrentUnderstanding />




      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening Care information…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
