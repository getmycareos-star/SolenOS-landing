import "@/app/workspace/experience-design-system.css";
import "@/app/workspace/experience-design-system-v2.css";
import "@/app/workspace/navigation-accessibility.css";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { WorkspaceErrorFallback } from "@/components/app-shell/WorkspaceErrorFallback";
import { WorkspaceShellContent } from "@/components/app-shell/WorkspaceShellContent";
import type { ReactNode } from "react";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <ErrorBoundary name="Workspace" fallback={<WorkspaceErrorFallback />}>
        <WorkspaceShellContent>{children}</WorkspaceShellContent>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
