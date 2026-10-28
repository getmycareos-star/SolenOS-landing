"use client";

import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { BrandLoading } from "@/components/brand";

const WORKSPACE_NAV = [
  { href: "/workspace", label: "Living Care Record", icon: "◉" },
  { href: "/workspace/timeline", label: "Care Timeline", icon: "◷" },
  { href: "/workspace/documents", label: "Documents", icon: "📄" },
  { href: "/workspace/settings", label: "Settings", icon: "⚙" },
] as const;

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
              <span className="care-context-name">{runtime.situations.length} situations</span>
              <span className="care-context-status care-context-status--paused">
                No active
              </span>
            </>
          ) : (
            <span className="care-context-meta">Your Living Care Record</span>
          )}
        </div>
      </div>
    </div>
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
        <AppShell
          navItems={WORKSPACE_NAV}
          brandHref="/workspace"
          showFab={false}
          careContext={<CareContextBar />}
        >
          {children}
        </AppShell>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
