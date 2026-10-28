"use client";

import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { type ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { BrandLoading } from "@/components/brand";

const WORKSPACE_NAV = [
  { href: "/workspace", label: "Living Care Record", icon: "◉" },
  { href: "/workspace/timeline", label: "Care Timeline", icon: "◷" },
  { href: "/workspace/documents", label: "Documents", icon: "📄" },
  { href: "/workspace/settings", label: "Settings", icon: "⚙" },
] as const;

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
        >
          {children}
        </AppShell>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
