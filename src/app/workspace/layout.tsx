"use client";

import "./experience-design-system.css";
import "./experience-design-system-v2.css";
import "./navigation-accessibility.css";
import "./../accessibility-overrides.css";
import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceNavigationAccessibility } from "@/components/app-shell/WorkspaceNavigationAccessibility";
import { WorkspaceRouteBreadcrumbs } from "@/components/app-shell/WorkspaceRouteBreadcrumbs";
import { GlobalDisplayPreferences } from "@/components/accessibility/GlobalDisplayPreferences";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { BrandLoading } from "@/components/brand";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
              <span className="care-context-name">{caregiverSafeAssistantText(active.title) || "Care information"}</span>
              <span className={`care-context-status care-context-status--${active.status}`}>
                {caregiverStatusLabel(active.status) || "Status not available"}
              </span>
              {updatedLabel && (
                <span className="care-context-meta">Updated {updatedLabel}</span>
              )}
            </>
          ) : hasSituations ? (
            <>
              <span className="care-context-name">{runtime.situations.length} care areas</span>
              <span className="care-context-status care-context-status--paused">
                No active care area
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
  return (
    <>
      {recordLoadError ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
          }}
        >
          <span>
            Your server-backed Care Record could not be loaded. Offline drafts are not saved care records until the server confirms them.
          </span>
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
