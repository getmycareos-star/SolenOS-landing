import { WorkspaceProvider } from "@/lib/workspace-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { WorkspaceShellContent } from "@/components/app-shell/WorkspaceShellContent";
import type { ReactNode } from "react";

function WorkspaceErrorFallback() {
  return (
    <main className="workspace-error-recovery" role="alert" aria-labelledby="workspace-error-title">
      <section>
        <h1 id="workspace-error-title">We couldn't display your workspace</h1>
        <p>
          SolenOS could not display this part of your workspace. We cannot confirm whether your last action
          was saved, so check your Care Record before trying that action again.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </section>
    </main>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <ErrorBoundary name="Workspace" fallback={<WorkspaceErrorFallback />}>
        <WorkspaceShellContent>{children}</WorkspaceShellContent>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
