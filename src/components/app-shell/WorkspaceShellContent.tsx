"use client";


import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceNavigationAccessibility } from "@/components/app-shell/WorkspaceNavigationAccessibility";
import { WorkspaceRouteBreadcrumbs } from "@/components/app-shell/WorkspaceRouteBreadcrumbs";
import { GlobalDisplayPreferences } from "@/components/accessibility/GlobalDisplayPreferences";
import { BrandLoading } from "@/components/brand";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { useWorkspace } from "@/lib/workspace-context";

function formatUpdatedDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function CareContextBar() {
  const { runtime, recordLoadError } = useWorkspace();
  const active = runtime.situations.find((s) => s.status === "active");
  const hasSituations = runtime.situations.length > 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const updatedLabel = mounted && active ? formatUpdatedDate(active.updatedAt) : "";

  return (
    <section className="care-context-bar" aria-label="Care record status">
      <div className="care-context-inner">
        <div className="care-context-info" aria-live="polite" aria-atomic="true">
          {recordLoadError ? (
            <>
              <span className="care-context-name">Care information unavailable</span>
              <span className="care-context-status care-context-status--paused">Connection needed</span>
            </>
          ) : active ? (
            <>
              <span className="care-context-name">{caregiverSafeAssistantText(active.title) || "Care information"}</span>
              <span className={`care-context-status care-context-status--${active.status}`}>
                {caregiverStatusLabel(active.status) || "Status not available"}
              </span>
              {updatedLabel && <span className="care-context-meta">Updated {updatedLabel}</span>}
            </>
          ) : hasSituations ? (
            <>
              <span className="care-context-name">{runtime.situations.length} care areas</span>
              <span className="care-context-status care-context-status--paused">No active care area</span>
            </>
          ) : (
            <>
              <span className="care-context-name">No care details yet</span>
              <Link className="care-context-action" href="/workspace/daily-care">
                Add an update
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkspaceEntryGate({ children }: { children: ReactNode }) {
  const { entryReady, recordLoadError } = useWorkspace();

  if (!entryReady) {
    return (
      <main className="workspace-route-loading" role="status" aria-live="polite">
        <BrandLoading animate message="Preparing your care workspace…" />
      </main>
    );
  }

  return (
    <>
      {recordLoadError ? (
        <div className="workspace-connection-alert" role="alert" aria-live="assertive">
          <p>
            Your Care Record could not be loaded. Your saved information has not been confirmed as current.
            Reconnect before relying on the information shown here.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry connection
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}

/**
 * Visual workspace composition only. Session bootstrap and care-record loading
 * remain owned by WorkspaceProvider; display preferences and navigation
 * accessibility are mounted alongside, rather than inside, the page content.
 */
export function WorkspaceShellContent({ children }: { children: ReactNode }) {
  return (
    <WorkspaceEntryGate>
      <AppShell brandHref="/workspace" careContext={<CareContextBar />}>
        <WorkspaceRouteBreadcrumbs />
        {children}
      </AppShell>
      <WorkspaceNavigationAccessibility />
      <GlobalDisplayPreferences />
    </WorkspaceEntryGate>
  );
}
