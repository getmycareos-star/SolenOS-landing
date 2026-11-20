"use client";

import "./../accessibility-overrides.css";
import "./experience-design-system.css";
import "./experience-design-system-v2.css";
import "./navigation-accessibility.css";
import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceNavigationAccessibility } from "@/components/app-shell/WorkspaceNavigationAccessibility";
import { WorkspaceRouteBreadcrumbs } from "@/components/app-shell/WorkspaceRouteBreadcrumbs";
import { GlobalDisplayPreferences } from "@/components/accessibility/GlobalDisplayPreferences";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { BrandLoading } from "@/components/brand";

function formatUpdatedDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function CareContextBar() {
  const { runtime } = useWorkspace();
  const active = runtime.situations.find((s) => s.status === "active");
  const hasSituations = runtime.situations.length > 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatedLabel = mounted && active ? formatUpdatedDate(active.updatedAt) : "";

  return (
    <div className="care-context-bar">
      <div className="care-context-inner">
        <div className="care-context-info">
          {active ? (
            <>
              <span className="care-context-name">{active.title}</span>
              <span className={`care-context-status care-context-status--${active.status}`}>
                {active.status}
              </span>
              {updatedLabel && (
                <span className="care-context-meta">Updated {updatedLabel}</span>
              )}
            </>
          ) : hasSituations ? (
            <>
              <span className="care-context-name">{runtime.situations.length} care areas</span>
              <span className="care-context-status care-context-status--paused">
                No active
              </span>
            </>
          ) : (
            <span className="care-context-meta">Your Care Record</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Do not expose caregiver destinations until the workspace has completed its
 * server-issued anonymous/authenticated session bootstrap and entry decision.
 * Data authorization remains enforced by the API for every protected request.
 */
function WorkspaceEntryGate({ children }: { children: ReactNode }) {
  const { entryReady, recordLoadError } = useWorkspace();
  if (!entryReady) {
    return (
      <main className="workspace-route-loading" role="status" aria-live="polite">
        <BrandLoading animate message="Preparing your care workspace…" />
      </main>
    );
  }
  if (recordLoadError) {
    return (
      <main className="workspace-route-loading" role="alert" aria-live="assertive">
        <section style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Your care information isn’t available right now.</h1>
          <p>Check your connection and try again. Your saved care information has not been replaced.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      </main>
    );
  }
  return <>{children}</>;
}

/**
 * LCR entry is intentionally direct: no privacy checkbox, early-version
 * acknowledgement, or onboarding confirmation blocks workspace access.
 * Privacy and Terms remain discoverable through in-product navigation.
 * Authentication, record ownership, and action-specific authorisation remain
 * enforced by the server; removing a UI gate does not grant data permissions.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <ErrorBoundary name="Workspace" fallback={
        <div style={{ padding: "24px", textAlign: "center" }}>
          <p style={{ color: "#78716c" }}>The workspace encountered an error. Please refresh the page.</p>
        </div>
      }>
        <WorkspaceEntryGate>
          <AppShell
            brandHref="/workspace"
            careContext={<CareContextBar />}
          >
            <WorkspaceRouteBreadcrumbs />
            {children}
          </AppShell>
          <WorkspaceNavigationAccessibility />
          <GlobalDisplayPreferences />
        </WorkspaceEntryGate>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
