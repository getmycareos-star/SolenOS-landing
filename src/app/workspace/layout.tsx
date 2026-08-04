"use client";

import { AppShell } from "@/components/app-shell";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import type { ReactNode } from "react";

const WORKSPACE_NAV = [
  { href: "/workspace", label: "Living Care Record", icon: "◉" },
  { href: "/workspace/timeline", label: "Care Timeline", icon: "◷" },
  { href: "/workspace/documents", label: "Documents", icon: "📄" },
  { href: "/workspace/settings", label: "Settings", icon: "⚙" },
] as const;

function CareContextBar() {
  const { runtime, careKey } = useWorkspace();
  const active = runtime.situations.find((s) => s.status === "active");
  const hasSituations = runtime.situations.length > 0;

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
              <span className="care-context-meta">
                Updated {new Date(active.updatedAt).toLocaleDateString()}
              </span>
            </>
          ) : hasSituations ? (
            <>
              <span className="care-context-name">{runtime.situations.length} situations</span>
              <span className="care-context-status care-context-status--paused">
                No active
              </span>
            </>
          ) : (
            <span className="care-context-meta">No care situations yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <OnboardingGate>
        <AppShell
          navItems={WORKSPACE_NAV}
          brandHref="/workspace"
          careContext={<CareContextBar />}
        >
          {children}
        </AppShell>
      </OnboardingGate>
    </WorkspaceProvider>
  );
}
